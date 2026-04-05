import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, SUPPORTED_VOICES } from "./tts";
import { getDb } from "./db";
import { users, subscriptions, settings } from "../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { SignJWT } from "jose";
import { nanoid } from "nanoid";
import { checkRateLimit, clearRateLimit } from "./_core/rateLimit";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "secret");

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sanitizeText(text: string): string {
  return text.replace(/\0/g, "").replace(/[<>]/g, "").trim();
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    loginWithCode: publicProcedure
      .input(z.object({ code: z.string().length(6).regex(/^\d{6}$/) }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.ip || ctx.req.headers["x-forwarded-for"] as string || "unknown";
        if (!checkRateLimit(ip, 5, 15 * 60 * 1000)) {
          throw new Error("Too many attempts. Please wait 15 minutes.");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.select().from(users)
          .where(eq(users.telegramCode, input.code)).limit(1);
        if (result.length === 0) {
          throw new Error("Invalid code. Get your code from Telegram bot.");
        }
        const user = result[0];
        clearRateLimit(ip);
        if (user.role !== "admin") {
          const now = new Date();
          const subResult = await db.select().from(subscriptions)
            .where(and(eq(subscriptions.userId, user.id), gte(subscriptions.expiresAt, now)))
            .limit(1);
          if (subResult.length === 0) {
            throw new Error("No active subscription. Please contact admin.");
          }
        }
        const token = await new SignJWT({
          userId: user.id,
          telegramId: user.telegramId,
          name: user.telegramFirstName,
          role: user.role,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30d")
          .sign(JWT_SECRET);
        ctx.res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          secure: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: "strict",
        });
        return {
          success: true,
          name: user.telegramFirstName,
          username: user.telegramUsername,
          role: user.role,
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  admin: router({
    getUsers: publicProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const now = new Date();
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      const allSubs = await db.select().from(subscriptions);
      return allUsers.map(u => {
        const activeSub = allSubs
          .filter(s => s.userId === u.id && s.expiresAt && s.expiresAt > now)
          .sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];
        return { ...u, subscription: activeSub ?? null };
      });
    }),

    giveSubscription: publicProcedure
      .input(z.object({
        userId: z.string(),
        plan: z.enum(["trial", "1month", "3month", "6month", "lifetime"]),
        trialDays: z.number().min(1).max(365).optional(),
        note: z.string().max(200).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const now = new Date();
        let expiresAt: Date;
        switch (input.plan) {
          case "trial": expiresAt = addDays(now, input.trialDays ?? 3); break;
          case "1month": expiresAt = addMonths(now, 1); break;
          case "3month": expiresAt = addMonths(now, 3); break;
          case "6month": expiresAt = addMonths(now, 6); break;
          case "lifetime": expiresAt = addMonths(now, 1200); break;
          default: expiresAt = addMonths(now, 1);
        }
        const id = nanoid(36);
        await db.insert(subscriptions).values({
          id,
          userId: input.userId,
          plan: input.plan,
          startsAt: now,
          expiresAt,
          createdByAdmin: ctx.user.userId,
          note: input.note ?? null,
        });
        return { success: true, expiresAt };
      }),

    setRole: publicProcedure
      .input(z.object({ userId: z.string(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    getUserSubscriptions: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) return [];
        return db.select().from(subscriptions)
          .where(eq(subscriptions.userId, input.userId))
          .orderBy(desc(subscriptions.createdAt));
      }),

    cancelSubscription: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const now = new Date();
        await db.update(subscriptions).set({ expiresAt: now })
          .where(eq(subscriptions.userId, input.userId));
        return { success: true };
      }),
  }),

  subscription: router({
    myStatus: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { active: false, plan: null, expiresAt: null };
      if (ctx.user.role === "admin") return { active: true, plan: "admin", expiresAt: null };
      const db = await getDb();
      if (!db) return { active: false, plan: null, expiresAt: null };
      const now = new Date();
      const result = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
        .orderBy(desc(subscriptions.expiresAt))
        .limit(1);
      if (result.length === 0) return { active: false, plan: null, expiresAt: null };
      return { active: true, plan: result[0].plan, expiresAt: result[0].expiresAt };
    }),
  }),

  tts: router({
    generateAudio: publicProcedure
      .input(z.object({
        text: z.string().min(1).max(30000),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        tone: z.number().min(-20).max(20).default(0),
        speed: z.number().min(0.5).max(2.0).default(1.0),
        aspectRatio: z.enum(["9:16", "16:9"]).default("16:9"),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        if (ctx.user.role !== "admin") {
          const db = await getDb();
          if (db) {
            const now = new Date();
            const sub = await db.select().from(subscriptions)
              .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
              .limit(1);
            if (sub.length === 0) throw new Error("Subscription expired. Please contact admin.");
          }
        }
        const cleanText = sanitizeText(input.text);
        if (!cleanText) throw new Error("Invalid text input.");
        try {
          const result = await generateSpeech(cleanText, input.voice, input.speed, input.tone, input.aspectRatio);
          return {
            success: true,
            audioBase64: result.audioBuffer.toString("base64"),
            mimeType: "audio/mpeg",
            srtContent: result.srtContent,
            durationMs: result.durationMs,
          };
        } catch (error) {
          throw new Error("Failed to generate audio. Please try again.");
        }
      }),

    preview: publicProcedure
      .input(z.object({
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        tone: z.number().min(-20).max(20).default(0),
        speed: z.number().min(0.5).max(2.0).default(1.0),
      }))
      .mutation(async ({ input }) => {
        const testText = "မြန်မာ စာသားကို အသံပြောင်းပြီး SRT ဖိုင်ထုတ်ပေးပါသည်။";
        const result = await generateSpeech(testText, input.voice, input.speed, input.tone, "16:9");
        return {
          success: true,
          audio: result.audioBuffer.toString("base64"),
          mimeType: "audio/mpeg",
        };
      }),

    getVoices: publicProcedure.query(() => {
      return Object.entries(SUPPORTED_VOICES).map(([key, value]) => ({
        id: key,
        name: value.name,
      }));
    }),
  }),

  settings: router({
    get: publicProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) return { autoTrialEnabled: true, autoTrialDays: 7 };
      const rows = await db.select().from(settings);
      const map = Object.fromEntries(rows.map(r => [r.keyName, r.value]));
      return {
        autoTrialEnabled: map["auto_trial_enabled"] === "true",
        autoTrialDays: parseInt(map["auto_trial_days"] ?? "7"),
      };
    }),

    update: publicProcedure
      .input(z.object({
        autoTrialEnabled: z.boolean(),
        autoTrialDays: z.number().min(1).max(365),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(settings).values({ keyName: "auto_trial_enabled", value: String(input.autoTrialEnabled) })
          .onDuplicateKeyUpdate({ set: { value: String(input.autoTrialEnabled) } });
        await db.insert(settings).values({ keyName: "auto_trial_days", value: String(input.autoTrialDays) })
          .onDuplicateKeyUpdate({ set: { value: String(input.autoTrialDays) } });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
