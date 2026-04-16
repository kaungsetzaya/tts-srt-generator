import { randomBytes, randomUUID } from "crypto";
import { translateVideo, translateVideoLink } from "./videoTranslator";
import { dubVideoFromBuffer, dubVideoFromLink, type DubOptions } from "./videoDubber";
import { getQuotaStatus } from "./geminiTranslator";
import { createJob, getJob, updateJob, acquireSlot, releaseSlot } from "./jobs";
import { COOKIE_NAME, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG, FEATURES, PLANS, TRIAL_DEFAULTS, PAID_PLAN_LIMITS } from "@shared/const";
import type { TrialLimits, PlanLimits, TrialUsage, SubscriptionStatus } from "@shared/types";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSpeech, generateSpeechWithCharacter, SUPPORTED_VOICES, CHARACTER_VOICES, CharacterKey } from "./tts";
import { getDb } from "./db";
import { users, subscriptions, settings, ttsConversions, errorLogs } from "../drizzle/schema";
import { eq, desc, and, gte, sql, isNull, isNotNull, or } from "drizzle-orm";
import { SignJWT } from "jose";
import { checkRateLimit, clearRateLimit } from "./_core/rateLimit";
import { checkVideoApiRateLimit, checkIpRateLimit } from "./_core/apiRateLimit";
import { auditLog, isAllowedVideoUrl, isValidVideoBuffer, isValidCharacterId, isValidVoiceId, validateBase64VideoPrefix, sanitizeForAI } from "./_core/security";

// 🔐 JWT Secret - .env မှာ မသတ်မှတ်ရင် production တွင် crash ဖြစ်မည်
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("[SECURITY] FATAL: JWT_SECRET is not set in environment variables!");
}

// Process dub job in background
async function processDubJob(jobId: string, input: any, userId: string) {
  updateJob(jobId, { status: "processing", progress: 5, message: "Starting dubbing..." });
  
  try {
    const rawBase64 = input.videoBase64.includes(",") ? input.videoBase64.split(",")[1] : input.videoBase64;
    const videoBuffer = Buffer.from(rawBase64, "base64");
    
    updateJob(jobId, { progress: 10, message: "Validating video..." });
    if (videoBuffer.length > 25 * 1024 * 1024) throw new Error("ဖိုင်အကြီးလွန်ပါသည်။ အများဆုံး 25MB အထိသာ တင်နိုင်ပါသည်။");
    if (!isValidVideoBuffer(videoBuffer)) throw new Error("ဗီဒီယို ဖိုင် format မမှန်ပါ။");
    
    const dubOpts: DubOptions = {
      voice: input.voice, character: input.character, speed: input.speed, pitch: input.pitch,
      srtEnabled: input.srtEnabled, srtFontSize: input.srtFontSize, srtColor: input.srtColor,
      srtDropShadow: input.srtDropShadow, srtBlurBg: input.srtBlurBg, srtMarginV: input.srtMarginV,
      srtBlurSize: input.srtBlurSize, srtBlurColor: input.srtBlurColor, srtFullWidth: input.srtFullWidth,
      srtBorderRadius: input.srtBorderRadius, userApiKey: input.userApiKey,
    };
    
    updateJob(jobId, { progress: 20, message: "Processing video..." });
    await acquireSlot();
    let result;
    try { result = await dubVideoFromBuffer(videoBuffer, input.filename, dubOpts); } finally { releaseSlot(); }
    
    updateJob(jobId, { status: "completed", progress: 100, message: "Done!", result });
    
  } catch (err: any) {
    const rawMsg = err.message ?? "Dubbing failed.";
    let userMsg = rawMsg;
    if (rawMsg.includes("Command failed") || rawMsg.includes("/tmp/") || rawMsg.includes("/root/")) {
      userMsg = "ဗီဒီယို ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။";
    } else if (rawMsg.includes("Whisper")) {
      userMsg = "ဗီဒီယိုတွင် စကားပြောသံ ရှာမတွေ့ပါ။";
    }
    updateJob(jobId, { status: "failed", error: userMsg });
  }
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

// ─── Trial & Plan Limits (imported from shared) ────────────────────────────
function getTrialLimits(): TrialLimits {
  return { ...TRIAL_DEFAULTS };
}

function getPlanLimits(plan: string | null): PlanLimits {
  if (!plan) {
    return { charLimitStandard: 0, charLimitCharacter: 0, dailyTtsSrt: 0, dailyCharacterUse: 0, dailyAiVideo: 0, dailyVideoTranslate: 0 };
  }
  if (plan === PLANS.trial) {
    return { charLimitStandard: 20000, charLimitCharacter: 2000, dailyTtsSrt: 999, dailyCharacterUse: 999, dailyAiVideo: 999, dailyVideoTranslate: 999 };
  }
  return { charLimitStandard: PAID_PLAN_LIMITS.charLimitStandard, charLimitCharacter: PAID_PLAN_LIMITS.charLimitCharacter, dailyTtsSrt: PAID_PLAN_LIMITS.dailyTtsSrt, dailyCharacterUse: PAID_PLAN_LIMITS.dailyCharacterUse, dailyAiVideo: PAID_PLAN_LIMITS.dailyAiVideo, dailyVideoTranslate: PAID_PLAN_LIMITS.dailyVideoTranslate };
}

// Get TOTAL usage for trial users (entire trial period)
async function getTrialTotalUsage(userId: string) {
  const db = await getDb();
  if (!db) return { tts: 0, characterUse: 0, aiVideo: 0, aiVideoChar: 0, videoTranslate: 0 };
  
  // Use SQL count instead of fetching all records
  const [totalTts] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), eq(ttsConversions.feature, "tts"), isNull(ttsConversions.character)));
  
  const [totalChar] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), eq(ttsConversions.feature, "tts"), isNotNull(ttsConversions.character)));
  
  const [totalDub] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), or(eq(ttsConversions.feature, "dub_file"), eq(ttsConversions.feature, "dub_link")), isNull(ttsConversions.character)));
  
  const [totalDubChar] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), or(eq(ttsConversions.feature, "dub_file"), eq(ttsConversions.feature, "dub_link")), isNotNull(ttsConversions.character)));
  
  const [totalTranslate] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), or(eq(ttsConversions.feature, "translate_file"), eq(ttsConversions.feature, "translate_link"))));
  
  return {
    tts: totalTts?.count ?? 0,
    characterUse: totalChar?.count ?? 0,
    aiVideo: totalDub?.count ?? 0,
    aiVideoChar: totalDubChar?.count ?? 0,
    videoTranslate: totalTranslate?.count ?? 0
  };
}

async function getDailyUsage(userId: string) {
  const db = await getDb();
  if (!db) return { tts: 0, characterUse: 0, aiVideo: 0, videoTranslate: 0 };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Use SQL count instead of fetching all records
  const [dailyTts] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), eq(ttsConversions.feature, "tts"), isNull(ttsConversions.character), gte(ttsConversions.createdAt, todayStart)));
  
  const [dailyChar] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), eq(ttsConversions.feature, "tts"), isNotNull(ttsConversions.character), gte(ttsConversions.createdAt, todayStart)));
  
  const [dailyDub] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), or(eq(ttsConversions.feature, "dub_file"), eq(ttsConversions.feature, "dub_link")), gte(ttsConversions.createdAt, todayStart)));
  
  const [dailyTranslate] = await db.select({ count: sql<number>`count(*)` }).from(ttsConversions)
    .where(and(eq(ttsConversions.userId, userId), eq(ttsConversions.status, "success"), or(eq(ttsConversions.feature, "translate_file"), eq(ttsConversions.feature, "translate_link")), gte(ttsConversions.createdAt, todayStart)));
  
  return {
    tts: dailyTts?.count ?? 0,
    characterUse: dailyChar?.count ?? 0,
    aiVideo: dailyDub?.count ?? 0,
    videoTranslate: dailyTranslate?.count ?? 0
  };
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    loginWithCode: publicProcedure
      .input(z.object({ code: z.string().length(6).regex(/^\d{6}$/) }))
      .mutation(async ({ input, ctx }) => {
        // ✅ Rate Limit: 15 minutes window, 5 attempts
        const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
          || ctx.req.ip || "unknown";
        if (!checkRateLimit(ip, 5, 15 * 60 * 1000)) {
          throw new Error("Too many login attempts. Please wait 15 minutes before trying again.");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.select().from(users)
          .where(eq(users.telegramCode, input.code)).limit(1);
        if (result.length === 0) {
          throw new Error("Invalid code. Get your code from Telegram bot.");
        }
        const user = result[0];

        // 🔐 Dynamic OTP: Check code expiry (10 minutes)
        if (user.telegramCodeExpiresAt) {
          const expiresAt = new Date(user.telegramCodeExpiresAt);
          if (Date.now() > expiresAt.getTime()) {
            throw new Error("Code expired. Please get a new code from Telegram bot.");
          }
        }

        clearRateLimit(ip);

        // 🔐 Invalidate the code after use (one-time use)
        const sessionToken = randomBytes(Math.ceil(24/2)).toString("hex").slice(0, 24);
        const token = await new SignJWT({
          userId: user.id,
          telegramId: user.telegramId,
          name: user.telegramFirstName,
          role: user.role,
          sid: sessionToken,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30d")
          .sign(JWT_SECRET);

        // DB: update sessionToken + lastLoginAt + clear the code
        try {
          const db2 = await getDb();
          if (db2) await db2.update(users).set({
            lastLoginAt: new Date(),
            sessionToken: sessionToken,
            telegramCode: null,  // 🔐 One-time use: clear code after login
            telegramCodeExpiresAt: null,
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
        note: z.string().max(500).optional(),
        paymentMethod: z.string().max(30).optional(),
        paymentSlip: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const now = new Date();
        let expiresAt: Date;
        switch (input.plan) {
          case "trial": expiresAt = addDays(now, input.trialDays ?? 7); break;
          case "1month": expiresAt = addMonths(now, 1); break;
          case "3month": expiresAt = addMonths(now, 3); break;
          case "6month": expiresAt = addMonths(now, 6); break;
          case "lifetime": expiresAt = addMonths(now, 1200); break;
          default: expiresAt = addMonths(now, 1);
        }
        const id = randomBytes(Math.ceil(36/2)).toString("hex").slice(0, 36);
        await db.insert(subscriptions).values({
          id,
          userId: input.userId,
          plan: input.plan,
          startsAt: now,
          expiresAt,
          createdByAdmin: ctx.user.userId,
          paymentMethod: input.paymentMethod || null,
          paymentSlip: input.paymentSlip || null,
          note: input.note || null,
        });
        auditLog("GIVE_SUBSCRIPTION", ctx.user.userId, input.userId, `plan=${input.plan}, payment=${input.paymentMethod ?? 'unknown'}, expires=${expiresAt.toISOString()}`);
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

    deleteUser: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        if (input.userId === ctx.user.userId) throw new Error("Cannot delete your own account.");
        await db.delete(ttsConversions).where(eq(ttsConversions.userId, input.userId));
        await db.delete(subscriptions).where(eq(subscriptions.userId, input.userId));
        await db.delete(users).where(eq(users.id, input.userId));
        auditLog("DELETE_USER", ctx.user.userId, input.userId);
        return { success: true };
      }),
    getServerHealth: publicProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const os = await import("os");
        const toMB = (b: number) => Math.round(b / 1024 / 1024);
        const mem = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const cpus = os.cpus();
        const cpuUsage = cpus.length > 0 ? Math.round(cpus.reduce((sum, cpu) => {
          const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
          return sum + ((total - cpu.times.idle) / total) * 100;
        }, 0) / cpus.length) : 0;

        return {
          memory: { used: toMB(mem.rss), heap: toMB(mem.heapUsed), total: toMB(totalMem), free: toMB(freeMem), usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100) },
          cpu: String(cpuUsage),
          disk: "N/A",
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

        // Feature breakdown for monthly stats
        const [totalTTS] = await db.select({ count: sql<number>`count(*)` })
          .from(ttsConversions)
          .where(and(gte(ttsConversions.createdAt, monthAgo), eq(ttsConversions.feature, "tts")));
        const [totalVideoUpload] = await db.select({ count: sql<number>`count(*)` })
          .from(ttsConversions)
          .where(and(gte(ttsConversions.createdAt, monthAgo), eq(ttsConversions.feature, "dub_file")));
        const [totalVideoLink] = await db.select({ count: sql<number>`count(*)` })
          .from(ttsConversions)
          .where(and(gte(ttsConversions.createdAt, monthAgo), eq(ttsConversions.feature, "dub_link")));
        const [totalTranslateFile] = await db.select({ count: sql<number>`count(*)` })
          .from(ttsConversions)
          .where(and(gte(ttsConversions.createdAt, monthAgo), eq(ttsConversions.feature, "translate_file")));
        const [totalTranslateLink] = await db.select({ count: sql<number>`count(*)` })
          .from(ttsConversions)
          .where(and(gte(ttsConversions.createdAt, monthAgo), eq(ttsConversions.feature, "translate_link")));

        return {
          generations: { total: totalGen.count, today: todayGen.count, week: weekGen.count, month: monthGen.count },
          chars: { total: totalChars.sum ?? 0 },
          activeUsers: { today: activeToday.count, week: activeWeek.count },
          planCounts,
          featureBreakdown: {
            tts: totalTTS.count,
            videoUpload: totalVideoUpload.count,
            videoLink: totalVideoLink.count,
            translation: totalTranslateFile.count + totalTranslateLink.count,
          },
        };
      }),

    onlineUsers: publicProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeUsers = await db.select({ userId: ttsConversions.userId })
          .where(gte(ttsConversions.createdAt, fifteenMinsAgo))
          .groupBy(ttsConversions.userId);
        return {
          onlineCount: activeUsers.length,
          lastUpdated: new Date(),
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

    // ───── PREVIEW: Download short clip for browser preview ─────
    previewLink: publicProcedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        if (!isAllowedVideoUrl(input.url)) throw new Error("Invalid URL.");

        const { promises: fs } = await import("fs");
        const path = await import("path");
        const { tmpdir } = await import("os");
        const { downloadVideo } = await import("./_core/multiDownloader");

        const id = randomUUID();
        const tempPath = path.join(tmpdir(), `preview_${id}.mp4`);

        console.log(`[Preview] Starting: ${input.url}`);
        try {
          const result = await downloadVideo(input.url, tempPath, { timeout: 120000 });
          
          if (!result.success) {
            throw new Error(result.error || "Preview download failed");
          }

          const stat = await fs.stat(tempPath).catch(() => null);
          console.log(`[Preview] Size: ${stat?.size ?? 0} bytes`);
          if (!stat || stat.size < 1000) throw new Error("Preview file too small");

          const buffer = await fs.readFile(tempPath);
          console.log(`[Preview] ✅ Done: ${Math.round(buffer.length/1024)}KB`);
          return {
            success: true,
            videoBase64: buffer.toString('base64'),
            sizeMB: Math.round(buffer.length / 1024 / 1024 * 10) / 10
          };
        } catch(err: any) {
          console.error(`[Preview] ❌ ${err.message}`);
          throw err;
        } finally {
          await fs.unlink(tempPath).catch(() => {});
        }
      }),
    translateLink: publicProcedure.input(z.object({ url: z.string(), userApiKey: z.string().optional() })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Please login first.");
      
      // Rate limit check
      const ip = ctx.req?.headers?.["x-forwarded-for"] as string || ctx.req?.ip || "";
      const ipLimit = checkIpRateLimit(ip, "default");
      if (!ipLimit.allowed) throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(ipLimit.resetIn/60)} minutes.`);
      
      const userLimit = checkVideoApiRateLimit(ctx.user.userId, "translateLink");
      if (!userLimit.allowed) throw new Error(`Video translate limit reached (${userLimit.resetIn > 60 ? Math.ceil(userLimit.resetIn/60) + ' min' : userLimit.resetIn + ' sec'} cooldown).`);
      
      // 🔐 yt-dlp Domain Whitelist
      if (!isAllowedVideoUrl(input.url)) {
        throw new Error("ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။");
      }
      const db = await getDb();
      if (ctx.user.role !== "admin" && db) {
        const now = new Date();
        const sub = await db.select().from(subscriptions)
          .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now))).limit(1);
        const plan = sub.length > 0 ? sub[0].plan : null;
        if (!plan) throw new Error("Subscription မရှိပါ။ Admin ကို ဆက်သွယ်ပါ။");
        if (plan === "trial") {
          const trialUsage = await getTrialTotalUsage(ctx.user.userId);
          const trialLimits = getTrialLimits();
          if (trialUsage.videoTranslate >= trialLimits.totalVideoTranslate) throw new Error("Trial ကာလအတွင်း Video Translation အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
        }
      }
      try {
        const result = await translateVideoLink(input.url, input.userApiKey);
        if (db && ctx.user) {
          await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "translate_link", status: "success" }).catch(() => {});
        }
        return { success: true, ...result };
      } catch (error: any) {
        // Track failed attempt for trial refund
        if (db && ctx.user) {
          await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "translate_link", status: "fail", errorMsg: (error?.message ?? "unknown").slice(0, 499) }).catch(() => {});
        }
        const rawMsg = error.message ?? "Link translation failed.";
        let userMsg = rawMsg;
        if (rawMsg.includes("Command failed:") || rawMsg.includes("/tmp/") || rawMsg.includes("/root/")) {
          if (rawMsg.includes("n challenge solving failed")) {
            userMsg = "YouTube ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ Admin ကို ဆက်သွယ်ပါ။";
          } else if (rawMsg.includes("Requested format is not available")) {
            userMsg = "ဗီဒီယို format ရနိုင်ခြင်းမရှိပါ။ တခြား link ဖြင့် ထပ်ကြိုးစားပါ။";
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
        userApiKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        
        // Rate limit check
        const ip = ctx.req?.headers?.["x-forwarded-for"] as string || ctx.req?.ip || "";
        const ipLimit = checkIpRateLimit(ip, "default");
        if (!ipLimit.allowed) throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(ipLimit.resetIn/60)} minutes.`);
        
        const userLimit = checkVideoApiRateLimit(ctx.user.userId, "translateFile");
        if (!userLimit.allowed) throw new Error(`Video translate limit reached (${userLimit.resetIn > 60 ? Math.ceil(userLimit.resetIn/60) + ' min' : userLimit.resetIn + ' sec'} cooldown).`);
        
        // 🔐 Base64 prefix validation
        if (!validateBase64VideoPrefix(input.videoBase64)) {
          throw new Error("Invalid video format.");
        }
        const db = await getDb();
        if (ctx.user.role !== "admin" && db) {
          const now = new Date();
          const sub = await db.select().from(subscriptions)
            .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
            .limit(1);
          const plan = sub.length > 0 ? sub[0].plan : null;
          if (!plan) throw new Error("Subscription မရှိပါ။ Admin ကို ဆက်သွယ်ပါ။");
          if (plan === "trial") {
            const trialUsage = await getTrialTotalUsage(ctx.user.userId);
            const trialLimits = getTrialLimits();
            if (trialUsage.videoTranslate >= trialLimits.totalVideoTranslate) throw new Error("Trial ကာလအတွင်း Video Translation အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
          }
        }
        try {
          const rawBase64 = input.videoBase64.includes(",") ? input.videoBase64.split(",")[1] : input.videoBase64;
          const videoBuffer = Buffer.from(rawBase64, "base64");
          if (videoBuffer.length > 25 * 1024 * 1024) throw new Error("ဖိုင်အကြီးလွန်ပါသည်။ အများဆုံး 25MB အထိသာ တင်နိုင်ပါသည်။");
          // 🔐 Magic bytes validation
          if (!isValidVideoBuffer(videoBuffer)) throw new Error("ဗီဒီယို ဖိုင် format မမှန်ပါ။ MP4, MOV, AVI, MKV, WebM ဖိုင်များသာ တင်နိုင်ပါသည်။");
          const result = await translateVideo(videoBuffer, input.filename, input.userApiKey);
          if (db && ctx.user) {
            await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "translate_file", status: "success" }).catch(() => {});
          }
          return { success: true, ...result };
        } catch (error: any) {
          if (db && ctx.user) {
            await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "translate_file", status: "fail", errorMsg: (error?.message ?? "unknown").slice(0, 499) }).catch(() => {});
          }
          const rawMsg = error.message ?? "Translation failed.";
          let userMsg = rawMsg;
          if (rawMsg.includes("Command failed") || rawMsg.includes("/tmp/") || rawMsg.includes("/root/")) {
            userMsg = "ဗီဒီယို ဘာသာပြန်၍ မရပါ။ ထပ်ကြိုးစားပါ။";
          } else if (rawMsg.includes("Whisper")) {
            userMsg = "ဗီဒီယိုတွင် စကားပြောသံ ရှာမတွေ့ပါ။ အသံပါသော ဗီဒီယိုကို ထပ်ကြိုးစားပါ။";
          }
          throw new Error(userMsg);
        }
      }),

    // ───── DUBBING: File Upload ─────
    dubFile: publicProcedure
      .input(z.object({
        videoBase64: z.string(),
        filename: z.string().max(255),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        character: z.string().optional(),
        speed: z.number().min(0.5).max(2.0).default(1.0),
        pitch: z.number().min(-20).max(20).default(0),
        srtEnabled: z.boolean().default(true),
        srtFontSize: z.number().min(12).max(48).optional(),
        srtColor: z.string().optional(),
        srtDropShadow: z.boolean().optional(),
        srtBlurBg: z.boolean().optional(),
        srtMarginV: z.number().min(0).max(200).optional(),
        srtBlurSize: z.number().min(0).max(30).optional(),
        srtBlurColor: z.enum(["black", "white"]).optional(),
        srtFullWidth: z.boolean().optional(),
        srtBorderRadius: z.enum(["rounded", "square"]).optional(),
        userApiKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        
        // Rate limit check
        const ip = ctx.req?.headers?.["x-forwarded-for"] as string || ctx.req?.ip || "";
        const ipLimit = checkIpRateLimit(ip, "default");
        if (!ipLimit.allowed) throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(ipLimit.resetIn/60)} minutes.`);
        
        const userLimit = checkVideoApiRateLimit(ctx.user.userId, "dubFile");
        if (!userLimit.allowed) throw new Error(`AI Video limit reached (${userLimit.resetIn > 60 ? Math.ceil(userLimit.resetIn/60) + ' min' : userLimit.resetIn + ' sec'} cooldown).`);
        
        // 🔐 Voice ID whitelist
        if (input.character && !isValidCharacterId(input.character)) throw new Error("Invalid character voice.");
        if (!validateBase64VideoPrefix(input.videoBase64)) throw new Error("Invalid video format.");
        const db = await getDb();
        const isCharVoice = !!(input.character && input.character.trim() !== "");
        if (ctx.user.role !== "admin" && db) {
          const now = new Date();
          const sub = await db.select().from(subscriptions)
            .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
            .limit(1);
          const plan = sub.length > 0 ? sub[0].plan : null;
          if (!plan) throw new Error("Subscription မရှိပါ။ Admin ကို ဆက်သွယ်ပါ။");
          if (plan === "trial") {
            const trialUsage = await getTrialTotalUsage(ctx.user.userId);
            const trialLimits = getTrialLimits();
            if (isCharVoice) {
              if (trialUsage.aiVideoChar >= trialLimits.totalAiVideoChar) throw new Error("Trial ကာလအတွင်း AI Video (Character Voice) အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
            } else {
              if (trialUsage.aiVideo >= trialLimits.totalAiVideo) throw new Error("Trial ကာလအတွင်း AI Video အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
            }
          }
        }
        try {
          const rawBase64 = input.videoBase64.includes(",") ? input.videoBase64.split(",")[1] : input.videoBase64;
          const videoBuffer = Buffer.from(rawBase64, "base64");
          if (videoBuffer.length > 25 * 1024 * 1024) throw new Error("ဖိုင်အကြီးလွန်ပါသည်။ အများဆုံး 25MB အထိသာ တင်နိုင်ပါသည်။");
          if (!isValidVideoBuffer(videoBuffer)) throw new Error("ဗီဒီယို ဖိုင် format မမှန်ပါ။");
          const dubOpts: DubOptions = {
            voice: input.voice, character: input.character, speed: input.speed, pitch: input.pitch,
            srtEnabled: input.srtEnabled, srtFontSize: input.srtFontSize, srtColor: input.srtColor,
            srtDropShadow: input.srtDropShadow, srtBlurBg: input.srtBlurBg, srtMarginV: input.srtMarginV,
            srtBlurSize: input.srtBlurSize, srtBlurColor: input.srtBlurColor, srtFullWidth: input.srtFullWidth,
            srtBorderRadius: input.srtBorderRadius, userApiKey: input.userApiKey,
          };
          await acquireSlot();
    let result;
    try { result = await dubVideoFromBuffer(videoBuffer, input.filename, dubOpts); } finally { releaseSlot(); }
          if (db && ctx.user) {
            await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "dub_file", character: input.character || undefined, status: "success" }).catch(() => {});
          }
          return { success: true, ...result };
        } catch (error: any) {
          // Track failure for trial refund
          if (db && ctx.user) {
            await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "dub_file", character: input.character || undefined, status: "fail", errorMsg: (error?.message ?? "unknown").slice(0, 499) }).catch(() => {});
          }
          const rawMsg = error.message ?? "Dubbing failed.";
          let userMsg = rawMsg;
          if (rawMsg.includes("Command failed") || rawMsg.includes("/tmp/") || rawMsg.includes("/root/")) {
            userMsg = "ဗီဒီယို ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။";
          } else if (rawMsg.includes("Whisper")) {
            userMsg = "ဗီဒီယိုတွင် စကားပြောသံ ရှာမတွေ့ပါ။";
          } else if (rawMsg.includes("MURF_API_KEY")) {
            userMsg = "Voice Change စနစ် ပြင်ဆင်ဆဲဖြစ်ပါသည်။ Standard Voice ကို သုံးပါ။";
          }
          throw new Error(userMsg);
        }
      }),

    // ───── DUBBING: URL Link ─────
    dubLink: publicProcedure
      .input(z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        character: z.string().optional(),
        speed: z.number().min(0.5).max(2.0).default(1.0),
        pitch: z.number().min(-20).max(20).default(0),
        srtEnabled: z.boolean().default(true),
        srtFontSize: z.number().min(12).max(48).optional(),
        srtColor: z.string().optional(),
        srtDropShadow: z.boolean().optional(),
        srtBlurBg: z.boolean().optional(),
        srtMarginV: z.number().min(0).max(200).optional(),
        srtBlurSize: z.number().min(0).max(30).optional(),
        srtBlurColor: z.enum(["black", "white"]).optional(),
        srtFullWidth: z.boolean().optional(),
        srtBorderRadius: z.enum(["rounded", "square"]).optional(),
        userApiKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        
        // Rate limit check
        const ip = ctx.req?.headers?.["x-forwarded-for"] as string || ctx.req?.ip || "";
        const ipLimit = checkIpRateLimit(ip, "default");
        if (!ipLimit.allowed) throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(ipLimit.resetIn/60)} minutes.`);
        
        const userLimit = checkVideoApiRateLimit(ctx.user.userId, "dubLink");
        if (!userLimit.allowed) throw new Error(`AI Video limit reached (${userLimit.resetIn > 60 ? Math.ceil(userLimit.resetIn/60) + ' min' : userLimit.resetIn + ' sec'} cooldown).`);
        
        if (!isAllowedVideoUrl(input.url)) throw new Error("ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။");
        if (input.character && !isValidCharacterId(input.character)) throw new Error("Invalid character voice.");
        const db = await getDb();
        const isCharVoice = !!(input.character && input.character.trim() !== "");
        if (ctx.user.role !== "admin" && db) {
          const now = new Date();
          const sub = await db.select().from(subscriptions)
            .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
            .limit(1);
          const plan = sub.length > 0 ? sub[0].plan : null;
          if (!plan) throw new Error("Subscription မရှိပါ။ Admin ကို ဆက်သွယ်ပါ။");
          if (plan === "trial") {
            const trialUsage = await getTrialTotalUsage(ctx.user.userId);
            const trialLimits = getTrialLimits();
            if (isCharVoice) {
              if (trialUsage.aiVideoChar >= trialLimits.totalAiVideoChar) throw new Error("Trial ကာလအတွင်း AI Video (Character Voice) အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
            } else {
              if (trialUsage.aiVideo >= trialLimits.totalAiVideo) throw new Error("Trial ကာလအတွင်း AI Video အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
            }
          }
        }
        try {
          const dubOpts: DubOptions = {
            voice: input.voice, character: input.character, speed: input.speed, pitch: input.pitch,
            srtEnabled: input.srtEnabled, srtFontSize: input.srtFontSize, srtColor: input.srtColor,
            srtDropShadow: input.srtDropShadow, srtBlurBg: input.srtBlurBg, srtMarginV: input.srtMarginV,
            srtBlurSize: input.srtBlurSize, srtBlurColor: input.srtBlurColor, srtFullWidth: input.srtFullWidth,
            srtBorderRadius: input.srtBorderRadius, userApiKey: input.userApiKey,
          };
          await acquireSlot();
          let result;
          try { result = await dubVideoFromLink(input.url, dubOpts); } finally { releaseSlot(); }
          if (db && ctx.user) {
            await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "dub_link", character: input.character || undefined, status: "success" }).catch(() => {});
          }
          return { success: true, ...result };
        } catch (error: any) {
          if (db && ctx.user) {
            await db.insert(ttsConversions).values({ id: randomBytes(Math.ceil(10/2)).toString("hex").slice(0, 10), userId: ctx.user.userId, feature: "dub_link", character: input.character || undefined, status: "fail", errorMsg: (error?.message ?? "unknown").slice(0, 499) }).catch(() => {});
          }
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
      if (!ctx.user) return { active: false, plan: null, expiresAt: null, limits: getPlanLimits(null), usage: { tts: 0, characterUse: 0, aiVideo: 0, videoTranslate: 0 }, trialUsage: null, trialLimits: null };
      if (ctx.user.role === "admin") return { active: true, plan: "admin", expiresAt: null, limits: getPlanLimits("lifetime"), usage: { tts: 0, characterUse: 0, aiVideo: 0, videoTranslate: 0 }, trialUsage: null, trialLimits: null };
      const db = await getDb();
      if (!db) return { active: false, plan: null, expiresAt: null, limits: getPlanLimits(null), usage: { tts: 0, characterUse: 0, aiVideo: 0, videoTranslate: 0 }, trialUsage: null, trialLimits: null };
      const now = new Date();
      const result = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
        .orderBy(desc(subscriptions.expiresAt))
        .limit(1);
      const plan = result.length > 0 ? result[0].plan : null;
      const limits = getPlanLimits(plan);
      const usage = await getDailyUsage(ctx.user.userId);

      // For trial users, also return total usage
      let trialUsage = null;
      let trialLimitsData = null;
      if (plan === "trial") {
        trialUsage = await getTrialTotalUsage(ctx.user.userId);
        trialLimitsData = getTrialLimits();
      }

      if (result.length === 0) return { active: false, plan: null, expiresAt: null, limits, usage, trialUsage: null, trialLimits: null };
      return { active: true, plan: result[0].plan, expiresAt: result[0].expiresAt, limits, usage, trialUsage, trialLimits: trialLimitsData };
    }),
  }),

  // ============ BACKGROUND JOBS ============
  jobs: router({
    // Start dub job (returns job ID immediately)
    startDub: publicProcedure
      .input(z.object({
        videoBase64: z.string(),
        filename: z.string().max(255),
        voice: z.enum(["thiha", "nilar"]).default("thiha"),
        character: z.string().optional(),
        speed: z.number().min(0.5).max(2.0).default(1.0),
        pitch: z.number().min(-20).max(20).default(0),
        srtEnabled: z.boolean().default(true),
        srtFontSize: z.number().min(12).max(48).optional(),
        srtColor: z.string().optional(),
        srtDropShadow: z.boolean().optional(),
        srtBlurBg: z.boolean().optional(),
        srtMarginV: z.number().min(0).max(200).optional(),
        srtBlurSize: z.number().min(0).max(30).optional(),
        srtBlurColor: z.enum(["black", "white"]).optional(),
        srtFullWidth: z.boolean().optional(),
        srtBorderRadius: z.enum(["rounded", "square"]).optional(),
        userApiKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        
        // Validate
        if (input.character && !isValidCharacterId(input.character)) throw new Error("Invalid character voice.");
        if (!validateBase64VideoPrefix(input.videoBase64)) throw new Error("Invalid video format.");
        
        // Create job
        const jobId = createJob("dub_file", { ...input, userId: ctx.user.userId });
        
        // Start processing in background (don't await)
        processDubJob(jobId, input, ctx.user.userId).catch(err => {
          console.error(`[Job ${jobId}] Error:`, err.message);
          updateJob(jobId, { status: "failed", error: err.message });
        });
        
        return { jobId, message: "Job started" };
      }),

    // Get job status
    getStatus: publicProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        const job = getJob(input.jobId);
        if (!job) throw new Error("Job not found");
        return {
          status: job.status,
          progress: job.progress,
          message: job.message,
          result: job.result,
          error: job.error,
        };
      }),
  }),

  // ============ USER HISTORY ============
  history: router({
    getMyHistory: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Please login first.");
        const db = await getDb();
        if (!db) return [];
        const history = await db.select().from(ttsConversions)
          .where(eq(ttsConversions.userId, ctx.user.userId))
          .orderBy(desc(ttsConversions.createdAt))
          .limit(input.limit);
        return history.map(h => ({
          id: h.id,
          feature: h.feature,
          voice: h.voice,
          character: h.character,
          charCount: h.charCount,
          durationMs: h.durationMs,
          status: h.status,
          createdAt: h.createdAt,
        }));
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
        // 🔐 Voice ID whitelist
        if (input.character && !isValidCharacterId(input.character)) throw new Error("Invalid character voice.");
        const db = await getDb();
        if (ctx.user.role !== "admin") {
          if (db) {
            const userRecord = await db.select().from(users)
              .where(eq(users.id, ctx.user.userId)).limit(1);
            if (userRecord[0]?.bannedAt) throw new Error("Your account has been banned.");
            const now = new Date();
            const sub = await db.select().from(subscriptions)
              .where(and(eq(subscriptions.userId, ctx.user.userId), gte(subscriptions.expiresAt, now)))
              .limit(1);
            const plan = sub.length > 0 ? sub[0].plan : null;
            if (!plan) throw new Error("Subscription မရှိပါ။ Admin ကို ဆက်သွယ်ပါ။");
            const limits = getPlanLimits(plan);
            const isCharacter = !!(input.character && input.character.trim() !== "");

            if (plan === "trial") {
              // Trial: TOTAL limits
              const trialUsage = await getTrialTotalUsage(ctx.user.userId);
              const trialLimits = getTrialLimits();
              if (isCharacter) {
                if (trialUsage.characterUse >= trialLimits.totalCharacterUse) throw new Error("Trial ကာလအတွင်း Character Voice အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
                if (input.text.length > trialLimits.charLimitCharacter) throw new Error(`Character Voice စာလုံးရေ ကန့်သတ်ချက် ${trialLimits.charLimitCharacter} ကျော်လွန်ပါသည်။`);
              } else {
                if (trialUsage.tts >= trialLimits.totalTtsSrt) throw new Error("Trial ကာလအတွင်း TTS/SRT အကြိမ်အရေအတွက် ပြည့်သွားပါပြီ။");
                if (input.text.length > trialLimits.charLimitStandard) throw new Error(`စာလုံးရေ ကန့်သတ်ချက် ${trialLimits.charLimitStandard} ကျော်လွန်ပါသည်။`);
              }
            } else {
              // Paid plans: daily limits
              const usage = await getDailyUsage(ctx.user.userId);
              if (isCharacter) {
                if (usage.characterUse >= limits.dailyCharacterUse) throw new Error(`ယနေ့ Character Voice အသုံးပြုမှု ကန့်သတ်ချက် ပြည့်သွားပါပြီ။`);
                if (input.text.length > limits.charLimitCharacter) throw new Error(`Character Voice စာလုံးရေ ကန့်သတ်ချက် ${limits.charLimitCharacter} ကျော်လွန်ပါသည်။`);
              } else {
                if (usage.tts >= limits.dailyTtsSrt) throw new Error(`ယနေ့ TTS/SRT အသုံးပြုမှု ကန့်သတ်ချက် ပြည့်သွားပါပြီ။`);
                if (input.text.length > limits.charLimitStandard) throw new Error(`စာလုံးရေ ကန့်သတ်ချက် ${limits.charLimitStandard} ကျော်လွန်ပါသည်။`);
              }
            }
          }
        }
        // 🔐 Content sanitization
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
            await db.insert(ttsConversions).values({
              id: randomBytes(5).toString('hex'), userId: ctx.user.userId, feature: "tts",
              voice: isCharacter ? undefined : input.voice,
              character: isCharacter ? input.character : undefined,
              charCount: cleanText.length, durationMs: result.durationMs,
              aspectRatio: input.aspectRatio, status: "success",
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
            await db.insert(ttsConversions).values({
              id: randomBytes(5).toString('hex'), userId: ctx.user.userId, feature: "tts",
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
        const baseVoiceMap: Record<string, { count: number; chars: number; durationMs: number }> = {};
        const characterMap: Record<string, { count: number; chars: number; durationMs: number; displayName: string; base: string }> = {};
        for (const r of rows) {
          const key = r.character ? `[Character] ${r.character}` : (r.voice ?? "unknown");
          if (!voiceMap[key]) voiceMap[key] = { count: 0, chars: 0, durationMs: 0 };
          voiceMap[key].count++; voiceMap[key].chars += r.charCount ?? 0; voiceMap[key].durationMs += r.durationMs ?? 0;
          if (r.character && r.character.trim() !== "") {
            const charKey = r.character;
            const charInfo = CHARACTER_VOICES[charKey as CharacterKey];
            if (!characterMap[charKey]) {
              characterMap[charKey] = { count: 0, chars: 0, durationMs: 0, displayName: charInfo?.name ?? charKey, base: charInfo?.base ?? "unknown" };
            }
            characterMap[charKey].count++; characterMap[charKey].chars += r.charCount ?? 0; characterMap[charKey].durationMs += r.durationMs ?? 0;
            const baseKey = charInfo?.base ?? "unknown";
            if (!baseVoiceMap[baseKey]) baseVoiceMap[baseKey] = { count: 0, chars: 0, durationMs: 0 };
            baseVoiceMap[baseKey].count++; baseVoiceMap[baseKey].chars += r.charCount ?? 0; baseVoiceMap[baseKey].durationMs += r.durationMs ?? 0;
          } else {
            const vKey = r.voice ?? "unknown";
            if (!baseVoiceMap[vKey]) baseVoiceMap[vKey] = { count: 0, chars: 0, durationMs: 0 };
            baseVoiceMap[vKey].count++; baseVoiceMap[vKey].chars += r.charCount ?? 0; baseVoiceMap[vKey].durationMs += r.durationMs ?? 0;
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
          baseVoices: Object.entries(baseVoiceMap).map(([name, d]) => ({
            name, displayName: SUPPORTED_VOICES[name as keyof typeof SUPPORTED_VOICES]?.name ?? name, ...d,
          })).sort((a,b) => b.count - a.count),
          characters: Object.entries(characterMap).map(([key, d]) => ({
            key, displayName: d.displayName, base: d.base,
            baseDisplayName: SUPPORTED_VOICES[d.base as keyof typeof SUPPORTED_VOICES]?.name ?? d.base,
            count: d.count, chars: d.chars, durationMs: d.durationMs,
          })).sort((a,b) => b.count - a.count),
        };
      }),

    getErrorLogs: publicProcedure
      .input(z.object({ limit: z.number().default(50), onlyUnresolved: z.boolean().default(false) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
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

    deleteSystemLog: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.delete(errorLogs).where(eq(errorLogs.id, input.id));
        return { success: true };
      }),

    dismissFailedGen: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.delete(ttsConversions).where(eq(ttsConversions.id, input.id));
        return { success: true };
      }),

    getChurnStats: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user || ctx.user.role !== "admin") throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("DB error");
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
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
      if (!db) return { autoTrialEnabled: true, autoTrialDays: 7, trialStartDate: null, trialEndDate: null, trialEnabled: false };
      const rows = await db.select().from(settings);
      const map = Object.fromEntries(rows.map(r => [r.keyName, r.value]));
      return {
        autoTrialEnabled: map["auto_trial_enabled"] === "true",
        autoTrialDays: parseInt(map["auto_trial_days"] ?? "7"),
        trialStartDate: map["trial_start_date"] || null,
        trialEndDate: map["trial_end_date"] || null,
        trialEnabled: map["trial_enabled"] === "true",
      };
    }),

    update: publicProcedure
      .input(z.object({
        autoTrialEnabled: z.boolean().optional(),
        autoTrialDays: z.number().min(1).max(365).optional(),
        trialStartDate: z.string().optional(),
        trialEndDate: z.string().optional(),
        trialEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new Error("Unauthorized");
        const db = await getDb();
        if (!db) throw new Error("DB not available");

        if (input.autoTrialEnabled !== undefined) {
          await db.insert(settings).values({ keyName: "auto_trial_enabled", value: String(input.autoTrialEnabled) })
            .onDuplicateKeyUpdate({ set: { value: String(input.autoTrialEnabled) } });
        }
        if (input.autoTrialDays !== undefined) {
          await db.insert(settings).values({ keyName: "auto_trial_days", value: String(input.autoTrialDays) })
            .onDuplicateKeyUpdate({ set: { value: String(input.autoTrialDays) } });
        }
        if (input.trialStartDate !== undefined) {
          await db.insert(settings).values({ keyName: "trial_start_date", value: input.trialStartDate })
            .onDuplicateKeyUpdate({ set: { value: input.trialStartDate } });
        }
        if (input.trialEndDate !== undefined) {
          await db.insert(settings).values({ keyName: "trial_end_date", value: input.trialEndDate })
            .onDuplicateKeyUpdate({ set: { value: input.trialEndDate } });
        }
        if (input.trialEnabled !== undefined) {
          await db.insert(settings).values({ keyName: "trial_enabled", value: String(input.trialEnabled) })
            .onDuplicateKeyUpdate({ set: { value: String(input.trialEnabled) } });
        }

        return { success: true };
      }),
  }),

  // ============ BROWSER ERROR LOGGING ============
  logBrowserError: publicProcedure
    .input(z.object({
      errorMessage: z.string().max(2000),
      errorCode: z.string().max(100).optional(),
      stackTrace: z.string().max(5000).optional(),
      url: z.string().max(500).optional(),
      source: z.enum(["window.onerror", "unhandledrejection", "react_error_boundary"]).default("window.onerror"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const id = randomBytes(Math.ceil(36/2)).toString("hex").slice(0, 36);
      await db.insert(errorLogs).values({
        id,
        userId: ctx.user?.userId || null,
        feature: `browser:${input.source}`,
        errorCode: input.errorCode || input.source,
        errorMessage: `[${input.url || 'unknown'}] ${input.errorMessage}`.slice(0, 2000),
        stackTrace: input.stackTrace?.slice(0, 5000) || null,
        severity: "error",
        resolved: false,
      });
      return { success: true };
    }),
});

export type AppRouter = typeof appRouter;

// ───── VIDEO PREVIEW DOWNLOAD (for dubbing tab live preview) ─────
// This is appended before the closing brace - add inside appRouter manually
