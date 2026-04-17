import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import {
  generateSpeech,
  SUPPORTED_VOICES,
  generateSpeechWithCharacter,
} from "./tts";
import { dubVideoFromBuffer, dubVideoFromLink } from "./videoDubber";
import { translateVideo, translateVideoLink } from "./videoTranslator";
import { isAllowedVideoUrl } from "./_core/security";
import { getDb } from "./db";
import {
  users,
  ttsConversions,
  subscriptions,
  errorLogs,
  settings,
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
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database not available",
          });

        const code = typeof input === "string" ? input : input.code;
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

        let result;
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
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to generate audio.",
          });
        }

        if (!result || !result.audioBuffer || result.audioBuffer.length === 0) {
          console.error("[TTS Error] Empty audio buffer returned");
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
    fromLink: t.procedure
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
    dubFile: t.procedure
      .input(
        z.object({
          videoBase64: z.string(),
          filename: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.videoBase64, "base64");
          return await dubVideoFromBuffer(buffer, input.filename, {
            voice: input.voice,
            speed: input.speed ?? 1,
            pitch: 0,
            srtEnabled: true,
          });
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to dub video.",
          });
        }
      }),
    dubLink: t.procedure
      .input(
        z.object({
          url: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await dubVideoFromLink(input.url, {
            voice: input.voice,
            speed: input.speed ?? 1,
            pitch: 0,
            srtEnabled: true,
          });
        } catch (error: any) {
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
    translate: t.procedure
      .input(z.object({ videoBase64: z.string(), filename: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.videoBase64, "base64");
          const result = await translateVideo(buffer, input.filename);
          return {
            success: true,
            englishText: result.englishText,
            myanmarText: result.myanmarText,
            srtContent: result.srtContent,
          };
        } catch (error: any) {
          console.error("[Video Translate Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to translate video.",
          });
        }
      }),
    translateLink: t.procedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await translateVideoLink(input.url);
          return {
            success: true,
            englishText: result.englishText,
            myanmarText: result.myanmarText,
            srtContent: result.srtContent,
          };
        } catch (error: any) {
          console.error("[Video Translate Link Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to translate video link.",
          });
        }
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
      if (!ctx.user) return { active: false, plan: null };
      const db = await getDb();
      if (!db) return { active: false, plan: null };
      try {
        const sub = await db.query.subscriptions.findFirst({
          where: (s: any, { eq, and, gt }: any) =>
            and(eq(s.userId, ctx.user!.userId), gt(s.expiresAt, new Date())),
          orderBy: (s: any, { desc }: any) => desc(s.createdAt),
        });
        return sub
          ? { active: true, plan: sub.plan, expiresAt: sub.expiresAt }
          : { active: false, plan: null };
      } catch {
        return { active: false, plan: null };
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
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .insert(settings)
          .values({ keyName: input.key, value: input.value })
          .onDuplicateKeyUpdate({ set: { value: input.value } });
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
        return userList.map(user => {
          const userSub = allSubs.find(s => s.userId === user.id);
          const userGen = allGenCounts.find(g => g.userId === user.id);
          return {
            ...user,
            subscription: userSub || null,
            genCount: userGen?.count || 0,
            daysLeft: userSub
              ? Math.ceil(
                  (new Date(userSub.expiresAt).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              : 0,
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

        // Check if user has active subscription
        const existingSubs = await db
          .select()
          .from(subscriptions)
          .where(sql`user_id = ${input.userId} AND expires_at > NOW()`)
          .limit(1);

        if (existingSubs.length > 0) {
          // Extend existing subscription
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
          // Create new subscription
          await db.insert(subscriptions).values({
            id: randomUUID(),
            userId: input.userId,
            plan: input.plan,
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + input.days * 86400000),
            note: input.note,
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
      return {
        uptime: process.uptime(),
        memory: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
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
        if (!db) return [];
        try {
          return await db
            .select()
            .from(errorLogs)
            .orderBy(desc(errorLogs.createdAt))
            .limit(input.limit || 50);
        } catch {
          return [];
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

          // Character usage stats
          const charRows = await db
            .select({ character: ttsConversions.character, count: count() })
            .from(ttsConversions)
            .groupBy(ttsConversions.character);
          const characters = charRows
            .filter(r => r.character)
            .map(r => ({ character: r.character, count: r.count }));

          // Total counts
          const [totalRow] = await db
            .select({
              count: count(),
              chars: sql`SUM(char_count)`,
              duration: sql`SUM(duration_ms)`,
            })
            .from(ttsConversions);

          // Base voices (Thiha/Nilar breakdown)
          const baseVoices = voiceRows
            .filter(r => r.voice && ["thiha", "nilar"].includes(r.voice))
            .map(r => ({ name: r.voice, count: r.count }));

          return {
            voices,
            features,
            baseVoices,
            characters,
            total: totalRow?.count || 0,
            totalChars: totalRow?.chars || 0,
            totalDurationMs: totalRow?.duration || 0,
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
      if (!db) return { churnRate: 0, newUsers: 0, lostUsers: 0 };
      try {
        const [newUsersRow] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`);
        return {
          churnRate: 0,
          newUsers: newUsersRow?.count || 0,
          lostUsers: 0,
        };
      } catch {
        return { churnRate: 0, newUsers: 0, lostUsers: 0 };
      }
    }),
    onlineUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { count: 0 };
      try {
        const [row] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`last_login_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`);
        return { count: row?.count || 0 };
      } catch {
        return { count: 0 };
      }
    }),
    getUserDetail: adminProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { user: null, history: [], subscription: null };
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, input.userId))
            .limit(1);
          const history = await db
            .select()
            .from(ttsConversions)
            .where(eq(ttsConversions.userId, input.userId))
            .orderBy(desc(ttsConversions.createdAt))
            .limit(50);
          const [sub] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, input.userId))
            .limit(1);
          return { user: user || null, history, subscription: sub || null };
        } catch {
          return { user: null, history: [], subscription: null };
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
