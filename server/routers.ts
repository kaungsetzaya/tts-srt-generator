import { translateVideo, translateVideoLink } from "./videoTranslator";
import { dubVideoFromBuffer, dubVideoFromLink, type DubOptions } from "./videoDubber";
import { getQuotaStatus } from "./geminiTranslator";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, generateSpeechWithCharacter, SUPPORTED_VOICES, CHARACTER_VOICES, CharacterKey } from "./tts";
import { getDb } from "./db";
import { users, subscriptions, settings, ttsConversions, errorLogs } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { nanoid } from "nanoid";
import { checkRateLimit, clearRateLimit } from "./_core/rateLimit";
import { auditLog } from "./_core/security";

// 🔐 JWT Secret — .env မှာ မသတ်မှတ်ရင် production တွင် crash ဖြစ်မည်
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("[SECURITY] FATAL: JWT_SECRET is not set in environment variables!");
  process.exit(1);
}
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-only-secret-do-not-use-in-production"
);

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
        // ✅ Rate Limit: 1 မိနစ်အတွင်း ၅ ကြိမ်သာ
        const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
          || ctx.req.ip || "unknown";
        if (!checkRateLimit(ip, 5, 60 * 1000)) {
          throw new Error("Too many login attempts. Please wait 1 minute before trying again.");
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
        // 🔐 One-Device Session: login တိုင်း session_token အသစ်ထုတ်မည်
        //    အဟောင်း JWT ထဲက session_token သည် DB နှင့် မတူတော့လို့ invalidate ဖြစ်မည်
        const sessionToken = nanoid(24);
        const token = await new SignJWT({
          userId: user.id,
          telegramId: user.telegramId,
          name: user.telegramFirstName,
          role: user.role,
          sid: sessionToken,  // session identifier
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30d")
          .sign(JWT_SECRET);
        // DB ထဲ sessionToken + lastLoginAt update
        try {
          const db2 = await getDb();
          if (db2) await db2.update(users).set({
            lastLoginAt: new Date(),
            sessionToken: sessionToken,
          }).where(eq(users.id, user.id));
        } catch {}
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000,
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
        auditLog("GIVE_SUBSCRIPTION", ctx.user.userId, input.userId, `plan=${input.plan}, expires=${expiresAt.toISOString()}`);
        return { success: true, expiresAt };
      }),

    setRole: publicProcedure
      .input(z.object({ userId: z.string(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        auditLog("SET_ROLE", ctx.user.userId, input.userId, `role=${input.role}`);
        return { success: true };
      }),

    banUser: publicProcedure
      .input(z.object({ userId: z.string(), ban: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.update(users).set({ bannedAt: input.ban ? new Date() : null }).where(eq(users.id, input.userId));
        auditLog(input.ban ? "BAN_USER" : "UNBAN_USER", ctx.user.userId, input.userId);
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
    translateLink: publicProcedure.input(z.object({ url: z.string() })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Please login first.");
      const db = await getDb();
      if (ctx.user.role !== "admin" && db) {
        const now = new Date();
        const sub = await db.select().from(subscriptions)
          .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now))).limit(1);
        if (sub.length === 0) throw new Error("Subscription expired.");
      }
      try {
        const result = await translateVideoLink(input.url);
        return { success: true, ...result };
      } catch (error: any) {
        // Sanitize: don't expose raw command output / server paths to frontend
        const rawMsg = error.message ?? "Link translation failed.";
        let userMsg = rawMsg;
        if (rawMsg.includes("Command failed:") || rawMsg.includes("/tmp/") || rawMsg.includes("/root/")) {
          // Extract only the meaningful part
          if (rawMsg.includes("n challenge solving failed")) {
            userMsg = "YouTube ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ yt-dlp version အဟောင်းကြောင့် ဖြစ်ပါသည်။ Admin ကို ဆက်သွယ်ပါ။";
          } else if (rawMsg.includes("Requested format is not available")) {
            userMsg = "ဗီဒီယို format ရနိုင်ခြင်းမရှိပါ။ တခြား link ဖြင့် ထပ်ကြိုးစားပါ။";
          } else if (rawMsg.includes("ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ")) {
            userMsg = rawMsg.split("\n")[0]; // First line only
          } else {
            userMsg = "ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။";
          }
        }
        throw new Error(userMsg);
      }
    }),
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

    // ───── DUBBING: File Upload ─────
    dubFile: publicProcedure
      .input(z.object({
        videoBase64: z.string(),
        filename: z.string().max(255),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        character: z.string().optional(),
        speed: z.number().min(0.5).max(2.0).default(1.1),
        pitch: z.number().min(-20).max(20).default(0),
        srtEnabled: z.boolean().default(true),
        srtFontSize: z.number().min(12).max(48).optional(),
        srtColor: z.string().optional(),
        srtDropShadow: z.boolean().optional(),
        srtBlurBg: z.boolean().optional(),
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
          const dubOpts: DubOptions = {
            voice: input.voice,
            character: input.character,
            speed: input.speed,
            pitch: input.pitch,
            srtEnabled: input.srtEnabled,
            srtFontSize: input.srtFontSize,
            srtColor: input.srtColor,
            srtDropShadow: input.srtDropShadow,
            srtBlurBg: input.srtBlurBg,
          };
          const result = await dubVideoFromBuffer(videoBuffer, input.filename, dubOpts);
          return { success: true, ...result };
        } catch (error: any) {
          const msg = error.message ?? "Dubbing failed.";
          throw new Error(msg.includes("/tmp/") || msg.includes("/root/") ? "Dubbing process failed. Please try again." : msg);
        }
      }),

    // ───── DUBBING: URL Link ─────
    dubLink: publicProcedure
      .input(z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        character: z.string().optional(),
        speed: z.number().min(0.5).max(2.0).default(1.1),
        pitch: z.number().min(-20).max(20).default(0),
        srtEnabled: z.boolean().default(true),
        srtFontSize: z.number().min(12).max(48).optional(),
        srtColor: z.string().optional(),
        srtDropShadow: z.boolean().optional(),
        srtBlurBg: z.boolean().optional(),
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
          const dubOpts: DubOptions = {
            voice: input.voice,
            character: input.character,
            speed: input.speed,
            pitch: input.pitch,
            srtEnabled: input.srtEnabled,
            srtFontSize: input.srtFontSize,
            srtColor: input.srtColor,
            srtDropShadow: input.srtDropShadow,
            srtBlurBg: input.srtBlurBg,
          };
          const result = await dubVideoFromLink(input.url, dubOpts);
          return { success: true, ...result };
        } catch (error: any) {
          const rawMsg = error.message ?? "Link dubbing failed.";
          let userMsg = rawMsg;
          if (rawMsg.includes("Command failed:") || rawMsg.includes("/tmp/") || rawMsg.includes("/root/")) {
            userMsg = "ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။";
          }
          throw new Error(userMsg);
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
          const isCharacter = !!(input.character && input.character.trim() !== "");
          if (isCharacter) {
            console.log(`[TTS REQUEST] 🔄 Character: ${input.character}`);
            result = await generateSpeechWithCharacter(cleanText, input.character as any, input.speed, input.aspectRatio, input.tone);
          } else {
            console.log(`[TTS REQUEST] 🗣️ Voice: ${input.voice}`);
            result = await generateSpeech(cleanText, input.voice, input.speed, input.tone, input.aspectRatio);
          }
          if (db) {
            const { nanoid } = await import("nanoid");
            await db.insert(ttsConversions).values({
              id: nanoid(10),
              userId: ctx.user.userId,
              feature: "tts",
              voice: isCharacter ? undefined : input.voice,
              character: isCharacter ? input.character : undefined,
              charCount: cleanText.length,
              durationMs: result.durationMs,
              aspectRatio: input.aspectRatio,
              status: "success",
            }).catch(() => {});
          }
          return {
            success: true,
            audioBase64: result.audioBuffer.toString("base64"),
            mimeType: "audio/mpeg",
            srtContent: result.srtContent,
            durationMs: result.durationMs,
          };
        } catch (error: any) {
          if (db) {
            const { nanoid } = await import("nanoid");
            await db.insert(ttsConversions).values({
              id: nanoid(10), userId: ctx.user.userId, feature: "tts",
              voice: input.voice, character: input.character, charCount: cleanText.length,
              status: "fail", errorMsg: (error?.message ?? "unknown").slice(0, 499),
            }).catch(() => {});
          }
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

  // ============ EXTENDED ADMIN ANALYTICS ============
  adminStats: router({

    // --- Per-user detail: daily gens, feature breakdown, active hours ---
    getUserDetail: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        const allGens = await db.select().from(ttsConversions)
          .where(and(eq(ttsConversions.userId, input.userId), gte(ttsConversions.createdAt, thirtyDaysAgo)))
          .orderBy(desc(ttsConversions.createdAt));
        // Group by date for daily chart
        const dailyMap: Record<string, number> = {};
        const featureMap: Record<string, number> = {};
        const hourMap: Record<number, number> = {};
        const voiceMap: Record<string, number> = {};
        const statusCount = { success: 0, fail: 0 };
        for (const g of allGens) {
          const day = (g.createdAt as Date).toISOString().split("T")[0];
          dailyMap[day] = (dailyMap[day] ?? 0) + 1;
          const feat = g.feature ?? "tts";
          featureMap[feat] = (featureMap[feat] ?? 0) + 1;
          const hour = (g.createdAt as Date).getHours();
          hourMap[hour] = (hourMap[hour] ?? 0) + 1;
          const v = g.character ?? g.voice ?? "unknown";
          voiceMap[v] = (voiceMap[v] ?? 0) + 1;
          if (g.status === "fail") statusCount.fail++; else statusCount.success++;
        }
        // Last 7 days summary
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const recent = allGens.filter(g => (g.createdAt as Date) >= sevenDaysAgo);
        const totalChars = allGens.reduce((s, g) => s + (g.charCount ?? 0), 0);
        const totalDuration = allGens.reduce((s, g) => s + (g.durationMs ?? 0), 0);
        return {
          totalGens: allGens.length, recentGens: recent.length,
          totalChars, totalDurationMs: totalDuration,
          daily: Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a,b) => a.date.localeCompare(b.date)),
          features: Object.entries(featureMap).map(([feature, count]) => ({ feature, count })),
          activeHours: Object.entries(hourMap).map(([hour, count]) => ({ hour: Number(hour), count })).sort((a,b) => a.hour - b.hour),
          voices: Object.entries(voiceMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count),
          statusBreakdown: statusCount,
          recentLogs: allGens.slice(0, 20).map(g => ({
            id: g.id, feature: g.feature, voice: g.voice, character: g.character,
            charCount: g.charCount, durationMs: g.durationMs, status: g.status,
            errorMsg: g.errorMsg, createdAt: g.createdAt,
          })),
        };
      }),

    // --- Voice/Character usage stats with timeframe ---
    getVoiceStats: publicProcedure
      .input(z.object({ timeframe: z.enum(["week", "month", "year", "all"]) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        const now = new Date();
        const since = input.timeframe === "week" ? new Date(now.getTime() - 7 * 86400000)
          : input.timeframe === "month" ? new Date(now.getTime() - 30 * 86400000)
          : input.timeframe === "year" ? new Date(now.getTime() - 365 * 86400000)
          : new Date(0);
        const rows = await db.select().from(ttsConversions).where(gte(ttsConversions.createdAt, since));
        const voiceMap: Record<string, { count: number; chars: number; durationMs: number }> = {};
        const featureMap: Record<string, number> = {};
        const dailyMap: Record<string, number> = {};
        // Separate base voice vs character tracking
        const baseVoiceMap: Record<string, { count: number; chars: number; durationMs: number }> = {};
        const characterMap: Record<string, { count: number; chars: number; durationMs: number; displayName: string; base: string }> = {};
        for (const r of rows) {
          const key = r.character ? `[Character] ${r.character}` : (r.voice ?? "unknown");
          if (!voiceMap[key]) voiceMap[key] = { count: 0, chars: 0, durationMs: 0 };
          voiceMap[key].count++;
          voiceMap[key].chars += r.charCount ?? 0;
          voiceMap[key].durationMs += r.durationMs ?? 0;
          // Track base voices separately
          if (r.character && r.character.trim() !== "") {
            const charKey = r.character;
            const charInfo = CHARACTER_VOICES[charKey as CharacterKey];
            if (!characterMap[charKey]) {
              characterMap[charKey] = {
                count: 0, chars: 0, durationMs: 0,
                displayName: charInfo?.name ?? charKey,
                base: charInfo?.base ?? "unknown",
              };
            }
            characterMap[charKey].count++;
            characterMap[charKey].chars += r.charCount ?? 0;
            characterMap[charKey].durationMs += r.durationMs ?? 0;
            // Also count under the base voice
            const baseKey = charInfo?.base ?? "unknown";
            if (!baseVoiceMap[baseKey]) baseVoiceMap[baseKey] = { count: 0, chars: 0, durationMs: 0 };
            baseVoiceMap[baseKey].count++;
            baseVoiceMap[baseKey].chars += r.charCount ?? 0;
            baseVoiceMap[baseKey].durationMs += r.durationMs ?? 0;
          } else {
            const vKey = r.voice ?? "unknown";
            if (!baseVoiceMap[vKey]) baseVoiceMap[vKey] = { count: 0, chars: 0, durationMs: 0 };
            baseVoiceMap[vKey].count++;
            baseVoiceMap[vKey].chars += r.charCount ?? 0;
            baseVoiceMap[vKey].durationMs += r.durationMs ?? 0;
          }
          const feat = r.feature ?? "tts";
          featureMap[feat] = (featureMap[feat] ?? 0) + 1;
          const day = (r.createdAt as Date).toISOString().split("T")[0];
          dailyMap[day] = (dailyMap[day] ?? 0) + 1;
        }
        return {
          total: rows.length,
          voices: Object.entries(voiceMap).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.count - a.count),
          features: Object.entries(featureMap).map(([feature, count]) => ({ feature, count })),
          daily: Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a,b) => a.date.localeCompare(b.date)),
          totalChars: rows.reduce((s, r) => s + (r.charCount ?? 0), 0),
          totalDurationMs: rows.reduce((s, r) => s + (r.durationMs ?? 0), 0),
          // New: breakdown by base voice and character
          baseVoices: Object.entries(baseVoiceMap).map(([name, d]) => ({
            name,
            displayName: SUPPORTED_VOICES[name as keyof typeof SUPPORTED_VOICES]?.name ?? name,
            ...d,
          })).sort((a,b) => b.count - a.count),
          characters: Object.entries(characterMap).map(([key, d]) => ({
            key,
            displayName: d.displayName,
            base: d.base,
            baseDisplayName: SUPPORTED_VOICES[d.base as keyof typeof SUPPORTED_VOICES]?.name ?? d.base,
            count: d.count,
            chars: d.chars,
            durationMs: d.durationMs,
          })).sort((a,b) => b.count - a.count),
        };
      }),

    // --- Error logs ---
    getErrorLogs: publicProcedure
      .input(z.object({ limit: z.number().default(50), onlyUnresolved: z.boolean().default(false) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        // Also fetch failed tts_conversions as error events
        const failedGens = await db.select().from(ttsConversions)
          .where(eq(ttsConversions.status, "fail"))
          .orderBy(desc(ttsConversions.createdAt)).limit(input.limit);
        const systemLogs = await db.select().from(errorLogs)
          .orderBy(desc(errorLogs.createdAt)).limit(input.limit);
        return {
          failedGenerations: failedGens.map(g => ({
            id: g.id, userId: g.userId, feature: g.feature,
            errorMsg: g.errorMsg, createdAt: g.createdAt,
          })),
          systemLogs: systemLogs.map(l => ({
            id: l.id, userId: l.userId, feature: l.feature,
            errorCode: l.errorCode, errorMessage: l.errorMessage,
            severity: l.severity, resolved: l.resolved, createdAt: l.createdAt,
          })),
        };
      }),

    resolveError: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.update(errorLogs).set({ resolved: true }).where(eq(errorLogs.id, input.id));
        return { success: true };
      }),

    // --- Churn rate + Active/Inactive user lists ---
    getChurnStats: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("DB error");
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const allUsers = await db.select().from(users).where(eq(users.role, "user"));
      const allSubs = await db.select().from(subscriptions);
      const genCounts = await db.select({
        userId: ttsConversions.userId,
        lastAt: sql<Date>`max(created_at)`,
        count: sql<number>`count(*)`,
      }).from(ttsConversions).groupBy(ttsConversions.userId);
      const genMap = Object.fromEntries(genCounts.map(g => [g.userId, { lastAt: g.lastAt, count: g.count }]));
      const activeUsers: any[] = [];
      const inactiveUsers: any[] = [];
      for (const u of allUsers) {
        const activeSub = allSubs.find(s => s.userId === u.id && s.expiresAt && s.expiresAt > now);
        const lastGen = genMap[u.id]?.lastAt ? new Date(genMap[u.id].lastAt) : null;
        const isActive = lastGen && lastGen >= fourteenDaysAgo;
        const data = {
          id: u.id, name: u.telegramFirstName, username: u.telegramUsername,
          hasSub: !!activeSub, plan: activeSub?.plan ?? null,
          totalGens: genMap[u.id]?.count ?? 0, lastActive: lastGen,
          bannedAt: u.bannedAt,
        };
        if (isActive) activeUsers.push(data); else inactiveUsers.push(data);
      }
      // Churn: users who had sub 30d ago but no activity in last 14d
      const churned = inactiveUsers.filter(u => u.hasSub);
      const churnRate = allUsers.length > 0 ? Math.round((churned.length / allUsers.length) * 100) : 0;
      return {
        churnRate, totalUsers: allUsers.length,
        activeCount: activeUsers.length, inactiveCount: inactiveUsers.length,
        activeUsers: activeUsers.sort((a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0)),
        inactiveUsers: inactiveUsers.sort((a, b) => (b.totalGens) - (a.totalGens)),
      };
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
