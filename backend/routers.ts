import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import { generateSpeech, SUPPORTED_VOICES } from "./tts";
import { dubVideoFromBuffer, dubVideoFromLink } from "./videoDubber";
import { isAllowedVideoUrl } from "./_core/security";
import { getDb } from "./db";
import { users, ttsConversions, subscriptions, errorLogs, settings } from "../drizzle/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

import superjson from "superjson";

const t = initTRPC.create({
  transformer: superjson,
});

// Protected procedure (requires auth)
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Admin procedure
const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const appRouter = t.router({
  // ─── AUTH ────────────────────────────────
  auth: t.router({
    me: t.procedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return ctx.user;
    }),
    logout: t.procedure.mutation(async ({ ctx }) => {
      ctx.res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
      return { success: true };
    }),
    verify: t.procedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const code = typeof input === "string" ? input : input.code;
        const user = await db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.telegramCode, code),
        });

        if (!user || !user.telegramCodeExpiresAt || new Date(user.telegramCodeExpiresAt) < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired code" });
        }

        // Generate session token
        const sessionToken = randomUUID();
        const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-only-secret-do-not-use-in-production");

        // Update user: clear code, set session token
        await db.update(users).set({
          telegramCode: null,
          sessionToken,
          lastLoginAt: new Date(),
        }).where(eq(users.id, user.id));

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

        // Set cookie
        ctx.res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);

        return { success: true, userId: user.id, role: user.role || "user" };
      }),
  }),

  // ─── TTS ─────────────────────────────────
  tts: t.router({
    generateAudio: t.procedure
      .input(z.object({
        text: z.string(),
        voice: z.enum(["thiha", "nilar"]).optional(),
        rate: z.number().optional(),
        pitch: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await generateSpeech(input.text, input.voice, input.rate, input.pitch);
          return {
            audioUrl: "data:audio/mp3;base64," + result.audioBuffer.toString("base64"),
            srtContent: result.srtContent,
          };
        } catch (error: any) {
          console.error("[TTS Error]", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to generate audio." });
        }
      }),
  }),

  // ─── DUB (legacy) ───────────────────────
  dub: t.router({
    fromLink: t.procedure
      .input(z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar"]),
        speed: z.number().optional(),
        pitch: z.number().optional(),
        srtEnabled: z.boolean().optional(),
        userApiKey: z.string().optional(),
      }))
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
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to dub video." });
        }
      }),
  }),

  // ─── VIDEO ──────────────────────────────
  video: t.router({
    dubFile: t.procedure
      .input(z.object({ file: z.any(), voice: z.enum(["thiha", "nilar"]), speed: z.number().optional() }))
      .mutation(async ({ input }) => {
        throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "File dubbing coming soon" });
      }),
    dubLink: t.procedure
      .input(z.object({ url: z.string(), voice: z.enum(["thiha", "nilar"]), speed: z.number().optional() }))
      .mutation(async ({ input }) => {
        try {
          return await dubVideoFromLink(input.url, { voice: input.voice, speed: input.speed ?? 1, pitch: 0, srtEnabled: true });
        } catch (error: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to dub video." });
        }
      }),
    previewLink: t.procedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        return { title: "Video", duration: 0, thumbnail: "" };
      }),
    translate: t.procedure
      .input(z.object({ file: z.any(), targetLang: z.string().optional() }))
      .mutation(async ({ input }) => {
        throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Video translation coming soon" });
      }),
    translateLink: t.procedure
      .input(z.object({ url: z.string(), targetLang: z.string().optional() }))
      .mutation(async ({ input }) => {
        throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Video translation coming soon" });
      }),
  }),

  // ─── JOBS ───────────────────────────────
  jobs: t.router({
    startDub: t.procedure
      .input(z.object({ url: z.string(), voice: z.enum(["thiha", "nilar"]), speed: z.number().optional() }))
      .mutation(async ({ input }) => {
        const jobId = randomUUID();
        // Start dub in background
        dubVideoFromLink(input.url, { voice: input.voice, speed: input.speed ?? 1, pitch: 0, srtEnabled: true })
          .then(() => console.log(`[Job ${jobId}] Complete`))
          .catch((e) => console.error(`[Job ${jobId}] Failed:`, e));
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
          const rows = await db.select().from(ttsConversions)
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
          where: (s: any, { eq, and, gt }: any) => and(eq(s.userId, ctx.user.userId), gt(s.expiresAt, new Date())),
          orderBy: (s: any, { desc }: any) => desc(s.createdAt),
        });
        return sub ? { active: true, plan: sub.plan, expiresAt: sub.expiresAt } : { active: false, plan: null };
      } catch {
        return { active: false, plan: null };
      }
    }),
  }),

  // ─── AI ─────────────────────────────────
  ai: t.router({
    chat: t.procedure
      .input(z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) }))
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
        await db.insert(settings).values({ keyName: input.key, value: input.value })
          .onDuplicateKeyUpdate({ set: { value: input.value } });
        return { success: true };
      }),
  }),

  // ─── ADMIN ──────────────────────────────
  admin: t.router({
    getUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try { return await db.select().from(users).limit(500); } catch { return []; }
    }),
    banUser: adminProcedure.input(z.object({ userId: z.string(), ban: z.boolean() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ bannedAt: input.ban ? new Date() : null }).where(eq(users.id, input.userId));
      return { success: true };
    }),
    deleteUser: adminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),
    giveSubscription: adminProcedure.input(z.object({
      userId: z.string(), plan: z.string(), days: z.number(), note: z.string().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(subscriptions).values({
        id: randomUUID(), userId: input.userId, plan: input.plan,
        startsAt: new Date(), expiresAt: new Date(Date.now() + input.days * 86400000), note: input.note,
      });
      return { success: true };
    }),
    cancelSubscription: adminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(subscriptions).set({ expiresAt: new Date() }).where(eq(subscriptions.userId, input.userId));
      return { success: true };
    }),
    setRole: adminProcedure.input(z.object({ userId: z.string(), role: z.string() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),
    getAnalytics: adminProcedure.query(async () => {
      return { totalUsers: 0, activeSubs: 0, totalConversions: 0, revenue: 0 };
    }),
    getServerHealth: adminProcedure.query(async () => {
      const mem = process.memoryUsage();
      return { uptime: process.uptime(), memory: Math.round(mem.heapUsed / 1024 / 1024) + "MB", status: "ok" };
    }),
  }),

  // ─── ADMIN STATS ────────────────────────
  adminStats: t.router({
    getErrorLogs: adminProcedure.input(z.object({ limit: z.number().optional(), onlyUnresolved: z.boolean().optional() }))
      .query(async () => { return []; }),
    getVoiceStats: adminProcedure.input(z.object({ timeframe: z.string().optional() }))
      .query(async () => { return { thiha: 0, nilar: 0, total: 0 }; }),
    getChurnStats: adminProcedure.query(async () => { return { churnRate: 0, newUsers: 0, lostUsers: 0 }; }),
    onlineUsers: adminProcedure.query(async () => { return { count: 0 }; }),
    getUserDetail: adminProcedure.input(z.object({ userId: z.string() }))
      .query(async ({ input }) => { return { user: null, history: [], subscription: null }; }),
    resolveError: adminProcedure.input(z.object({ errorId: z.string() })).mutation(async () => { return { success: true }; }),
    dismissFailedGen: adminProcedure.input(z.object({ id: z.string() })).mutation(async () => { return { success: true }; }),
    deleteSystemLog: adminProcedure.input(z.object({ id: z.string() })).mutation(async () => { return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
