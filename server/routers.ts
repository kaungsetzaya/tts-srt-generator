import { translateVideo, translateVideoLink } from "./videoTranslator";
import { getQuotaStatus } from "./geminiTranslator";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, generateSpeechWithCharacter, SUPPORTED_VOICES, CHARACTER_VOICES, CharacterKey } from "./tts";
import { getDb } from "./db";
import { users, subscriptions, settings, ttsConversions } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
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
        // Update last login
        try {
          const db = await getDb();
          if (db) await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        } catch {}
        // Update last login
        try {
          const db = await getDb();
          if (db) await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        } catch {}
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
      const genCounts = await db.select({
        userId: ttsConversions.userId,
        count: sql<number>`count(*)`,
        lastAt: sql<Date>`max(created_at)`,
      }).from(ttsConversions).groupBy(ttsConversions.userId);
      const genMap = Object.fromEntries(genCounts.map(g => [g.userId, { count: g.count, lastAt: g.lastAt }]));
      return allUsers.map(u => {
        const activeSub = allSubs
          .filter(s => s.userId === u.id && s.expiresAt && s.expiresAt > now)
          .sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];
        return { ...u, subscription: activeSub ?? null, genCount: genMap[u.id]?.count ?? 0, lastActive: genMap[u.id]?.lastAt ?? null };
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

    banUser: publicProcedure
      .input(z.object({ userId: z.string(), ban: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.update(users).set({ bannedAt: input.ban ? new Date() : null }).where(eq(users.id, input.userId));
        return { success: true };
      }),
    getServerHealth: publicProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const { execSync } = await import("child_process");
        const toMB = (b: number) => Math.round(b / 1024 / 1024);
        const mem = process.memoryUsage();
        let cpu = "0", disk = "0/0", dbSize = "0";
        try { cpu = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'").toString().trim(); } catch {}
        try { disk = execSync("df -h / | tail -1 | awk '{print $3"/"$2}'").toString().trim(); } catch {}
        try { disk = execSync("df -h / | tail -1 | awk '{print $3"/"$2}'").toString().trim(); } catch {}
        return {
          memory: { used: toMB(mem.rss), heap: toMB(mem.heapUsed), total: toMB(mem.heapTotal) },
          cpu,
          disk,
          uptime: Math.floor(process.uptime()),
          nodeVersion: process.version,
        };
      }),
    getAnalytics: publicProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 86400000);
        const monthAgo = new Date(today.getTime() - 30 * 86400000);
        const [totalGen] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions);
        const [todayGen] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions).where(gte(ttsConversions.createdAt, today));
        const [weekGen] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions).where(gte(ttsConversions.createdAt, weekAgo));
        const [monthGen] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions).where(gte(ttsConversions.createdAt, monthAgo));
        const [totalChars] = await db.select({ sum: sql<number>`sum(char_count)` }).from(ttsConversions);
        const [activeToday] = await db.select({ count: sql<number>`count(distinct user_id)` }).from(ttsConversions).where(gte(ttsConversions.createdAt, today));
        const [activeWeek] = await db.select({ count: sql<number>`count(distinct user_id)` }).from(ttsConversions).where(gte(ttsConversions.createdAt, weekAgo));
        const planCounts = await db.select({ plan: subscriptions.plan, count: sql<number>`count(*)` })
          .from(subscriptions).where(gte(subscriptions.expiresAt, now)).groupBy(subscriptions.plan);
        return {
          generations: { total: totalGen.count, today: todayGen.count, week: weekGen.count, month: monthGen.count },
          chars: { total: totalChars.sum ?? 0 },
          activeUsers: { today: activeToday.count, week: activeWeek.count },
          planCounts,
        };
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

  video: router({
    getQuota: publicProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        return getQuotaStatus();
      }),
    translateLink: publicProcedure.input(z.object({ url: z.string() })).mutation(async ({ input, ctx }) => { if (!ctx.user) throw new Error("Please login first."); const db = await getDb(); if (ctx.user.role !== "admin" && db) { const now = new Date(); const sub = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now))).limit(1); if (sub.length === 0) throw new Error("Subscription expired."); } try { const result = await translateVideoLink(input.url); return { success: true, ...result }; } catch (error: any) { throw new Error(error.message ?? "Link translation failed."); } }),
    translate: publicProcedure
      .input(z.object({
        videoBase64: z.string(),
        filename: z.string().max(255),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        const db = await getDb();
        if (ctx.user.role !== "admin" && db) {
          const now = new Date();
          const sub = await db.select().from(subscriptions)
            .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
            .limit(1);
          if (sub.length === 0) throw new Error("Subscription expired.");
        }
        try {
          const videoBuffer = Buffer.from(input.videoBase64, "base64");
          if (videoBuffer.length > 25 * 1024 * 1024) throw new Error("File too large. Max 25MB.");
          const result = await translateVideo(videoBuffer, input.filename);
          return { success: true, ...result };
        } catch (error: any) {
          throw new Error(error.message ?? "Translation failed.");
        }
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
        character: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        const db = await getDb();
        if (ctx.user.role !== "admin") {
          if (db) {
            // Check ban
            const userRecord = await db.select().from(users)
              .where(eq(users.id, ctx.user.userId)).limit(1);
            if (userRecord[0]?.bannedAt) throw new Error("Your account has been banned.");
            // Check subscription
            const now = new Date();
            const sub = await db.select().from(subscriptions)
              .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
              .limit(1);
            if (sub.length === 0) throw new Error("Subscription expired. Please contact admin.");
          }
        }
        const cleanText = sanitizeText(input.text).replace(/[။၊]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanText) throw new Error("Invalid text input.");
        try {
          let result;
          if (input.character && input.character.trim() !== "") {
            console.log(`[TTS REQUEST] 🔄 Routing to Murf API for Character: ${input.character}`);
            // Character voice အတွက် `generateSpeechWithCharacter` ကို ခေါ်ပါမယ်
            result = await generateSpeechWithCharacter(cleanText, input.character as any, input.speed, input.aspectRatio);
          } else {
            console.log(`[TTS REQUEST] 🗣️ Routing to Standard TTS for Voice: ${input.voice}`);
            // Standard voice အတွက် `generateSpeech` ကို ခေါ်ပါမယ်
            result = await generateSpeech(cleanText, input.voice, input.speed, input.tone, input.aspectRatio);
          }
          // Save stats (privacy-friendly - no text content)
          if (db) {
            const { nanoid } = await import("nanoid");
            await db.insert(ttsConversions).values({
              id: nanoid(10),
              userId: ctx.user.userId,
              voice: input.voice,
              charCount: cleanText.length,
              durationMs: result.durationMs,
              aspectRatio: input.aspectRatio,
            }).catch(() => {});
          }
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

    getCharacters: publicProcedure.query(() => {
      return Object.entries(CHARACTER_VOICES).map(([key, value]) => ({
        id: key,
        name: value.name,
        gender: value.gender,
      }));
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
