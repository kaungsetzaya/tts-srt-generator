/**
 * Admin Stats Router — error logs, voice stats, generation overview, churn analysis
 */
import { z } from "zod";
import { t, adminProcedure } from "./trpc";
import { getDb } from "../db";
import {
  users,
  ttsConversions,
  subscriptions,
  errorLogs,
} from "../../drizzle/schema";
import { eq, desc, count, sql } from "drizzle-orm";

export const adminStatsRouter = t.router({
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
        const unresolvedFilter = input.onlyUnresolved ? eq(errorLogs.resolved, false) : sql`1=1`;
        
        const systemLogs = await db
          .select()
          .from(errorLogs)
          .where(unresolvedFilter)
          .orderBy(desc(errorLogs.createdAt))
          .limit(input.limit || 100);

        // Also fetch business-level task failures from tts_conversions
        const failedGens = await db
          .select()
          .from(ttsConversions)
          .where(eq(ttsConversions.status, "fail"))
          .orderBy(desc(ttsConversions.createdAt))
          .limit(50);

        return { 
          failedGenerations: failedGens.map((g: any) => ({
            id: g.id,
            userId: g.userId,
            feature: g.feature || "tts",
            errorMsg: g.errorMsg || "Unknown error",
            createdAt: g.createdAt
          })), 
          systemLogs 
        };
      } catch (e) {
        console.error("[getErrorLogs Error]", e);
        return { failedGenerations: [], systemLogs: [] };
      }
    }),

  getVoiceStats: adminProcedure
    .input(z.object({ timeframe: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return {
          voices: [], features: [], baseVoices: [], characters: [],
          total: 0, totalChars: 0, totalDurationMs: 0,
        };
      try {
        const tfDays: Record<string, number> = { week: 7, month: 30, year: 365 };
        const days = input.timeframe ? tfDays[input.timeframe] : undefined;
        const dateFilter = days
          ? sql`created_at > DATE_SUB(NOW(), INTERVAL ${days} DAY)`
          : sql`1=1`;

        const voiceRows = await db
          .select({ voice: ttsConversions.voice, count: count() })
          .from(ttsConversions)
          .where(dateFilter)
          .groupBy(ttsConversions.voice);
        const voices = voiceRows
          .filter((r: any) => r.voice)
          .map((r: any) => ({ voice: r.voice, count: r.count }));

        const featureRows = await db
          .select({ feature: ttsConversions.feature, count: count() })
          .from(ttsConversions)
          .where(dateFilter)
          .groupBy(ttsConversions.feature);
        const features = featureRows
          .filter((r: any) => r.feature)
          .map((r: any) => ({ feature: r.feature, count: r.count }));

        const [totalRow] = await db
          .select({
            count: count(),
            chars: sql`SUM(char_count)`,
            duration: sql`SUM(duration_ms)`,
          })
          .from(ttsConversions)
          .where(dateFilter);

        const baseVoiceDetails = await db
          .select({
            voice: ttsConversions.voice,
            count: count(),
            chars: sql`COALESCE(SUM(char_count), 0)`,
            duration: sql`COALESCE(SUM(duration_ms), 0)`,
          })
          .from(ttsConversions)
          .where(days
            ? sql`voice IN ('thiha', 'nilar') AND created_at > DATE_SUB(NOW(), INTERVAL ${days} DAY)`
            : sql`voice IN ('thiha', 'nilar')`)
          .groupBy(ttsConversions.voice);

        const baseVoices = baseVoiceDetails.map((r: any) => ({
          name: r.voice,
          displayName:
            r.voice === "thiha" ? "Thiha (Male)" : "Nilar (Female)",
          count: r.count,
          chars: Number(r.chars),
          durationMs: Number(r.duration),
        }));

        const charDetails = await db
          .select({
            character: ttsConversions.character,
            voice: ttsConversions.voice,
            count: count(),
            chars: sql`COALESCE(SUM(char_count), 0)`,
            duration: sql`COALESCE(SUM(duration_ms), 0)`,
          })
          .from(ttsConversions)
          .where(days
            ? sql`\`character\` IS NOT NULL AND \`character\` != '' AND created_at > DATE_SUB(NOW(), INTERVAL ${days} DAY)`
            : sql`\`character\` IS NOT NULL AND \`character\` != ''`)
          .groupBy(ttsConversions.character, ttsConversions.voice);

        const characters = charDetails.map((r: any) => ({
          key: r.character,
          displayName: r.character,
          base: r.voice || "thiha",
          baseDisplayName: r.voice === "nilar" ? "Nilar" : "Thiha",
          count: r.count,
          chars: Number(r.chars),
          durationMs: Number(r.duration),
        }));

        return {
          voices: voices.map((v: any) => ({ name: v.voice, count: v.count })),
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
          voices: [], features: [], baseVoices: [], characters: [],
          total: 0, totalChars: 0, totalDurationMs: 0,
        };
      }
    }),

  getGenerationOverview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      return { today: 0, thisWeek: 0, thisMonth: 0, allTime: 0, activeHours: [], daily: [] };
    try {
      const [todayRow] = await db
        .select({ count: count() })
        .from(ttsConversions)
        .where(sql`DATE(created_at) = CURDATE()`);
      const [weekRow] = await db
        .select({ count: count() })
        .from(ttsConversions)
        .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`);
      const [monthRow] = await db
        .select({ count: count() })
        .from(ttsConversions)
        .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`);
      const [allTimeRow] = await db
        .select({ count: count() })
        .from(ttsConversions);

      const hourRows = await db
        .select({ hour: sql`HOUR(created_at)`, count: count() })
        .from(ttsConversions)
        .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
        .groupBy(sql`HOUR(created_at)`);
      const activeHours = hourRows.map((r: any) => ({
        hour: r.hour,
        count: r.count,
      }));

      const dailyRows = await db
        .select({ date: sql`DATE(created_at)`, count: count() })
        .from(ttsConversions)
        .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`);
      const daily = dailyRows.map((r: any) => ({ date: r.date, count: r.count }));

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
      return { today: 0, thisWeek: 0, thisMonth: 0, allTime: 0, activeHours: [], daily: [] };
    }
  }),

  getChurnStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      return {
        churnRate: 0, newUsers: 0, lostUsers: 0,
        activeUsers: [], inactiveUsers: [],
        activeCount: 0, inactiveCount: 0,
      };
    try {
      const [totalCountRow] = await db.select({ count: count() }).from(users);
      const totalUsers = totalCountRow?.count || 0;

      const [newUsersRow] = await db
        .select({ count: count() })
        .from(users)
        .where(sql`created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`);

      const activeUsersList = await db
        .select()
        .from(users)
        .where(sql`last_login_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`)
        .orderBy(desc(users.lastLoginAt))
        .limit(50);

      const inactiveUsersList = await db
        .select()
        .from(users)
        .where(sql`last_login_at < DATE_SUB(NOW(), INTERVAL 14 DAY) OR last_login_at IS NULL`)
        .orderBy(desc(users.lastLoginAt))
        .limit(50);

      const [inactiveCountRow] = await db
        .select({ count: count() })
        .from(users)
        .where(sql`last_login_at < DATE_SUB(NOW(), INTERVAL 14 DAY) OR last_login_at IS NULL`);
      
      const inactiveCount = inactiveCountRow?.count || 0;
      const churnRate = totalUsers > 0 ? Math.round((inactiveCount / totalUsers) * 100) : 0;

      const genCounts = await db
        .select({ userId: ttsConversions.userId, count: count() })
        .from(ttsConversions)
        .groupBy(ttsConversions.userId);

      const formatUser = (u: any) => ({
        id: u.id,
        name: u.telegramFirstName || u.name || "Unknown",
        username: u.telegramUsername || "",
        totalGens: genCounts.find((g: any) => g.userId === u.id)?.count || 0,
        lastActive: u.lastLoginAt,
        credits: u.credits || 0,
      });

      return {
        churnRate,
        newUsers: newUsersRow?.count || 0,
        lostUsers: inactiveCount,
        activeUsers: activeUsersList.map(formatUser),
        inactiveUsers: inactiveUsersList.map(formatUser),
        activeCount: activeUsersList.length,
        inactiveCount: inactiveCount,
      };
    } catch (e) {
      console.error("[getChurnStats Error]", e);
      return {
        churnRate: 0, newUsers: 0, lostUsers: 0,
        activeUsers: [], inactiveUsers: [],
        activeCount: 0, inactiveCount: 0,
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
        totalGens: 0, recentGens: 0, totalChars: 0, totalDurationMs: 0,
        statusBreakdown: { success: 0, fail: 0 },
        features: [], voices: [], activeHours: [], daily: [],
        recentLogs: [], subscription: null as any,
      };
      if (!db) return empty;
      try {
        const [stats30] = await db
          .select({
            count: count(),
            chars: sql`COALESCE(SUM(char_count),0)`,
            duration: sql`COALESCE(SUM(duration_ms),0)`,
          })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`);

        const [stats7] = await db
          .select({ count: count() })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`);

        const statusRows = await db
          .select({ status: sql`COALESCE(status, 'success')`, count: count() })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
          .groupBy(sql`COALESCE(status, 'success')`);

        const statusBreakdown: any = { success: 0, fail: 0 };
        statusRows.forEach((r: any) => {
          if (r.status === "fail") statusBreakdown.fail = r.count;
          else statusBreakdown.success = r.count;
        });

        const featureRows = await db
          .select({ feature: sql`COALESCE(feature, 'tts')`, count: count() })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
          .groupBy(sql`COALESCE(feature, 'tts')`);
        const features = featureRows.map((r: any) => ({ feature: r.feature, count: r.count }));

        const voiceRows = await db
          .select({ name: sql`COALESCE(character, voice, 'unknown')`, count: count() })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
          .groupBy(sql`COALESCE(character, voice, 'unknown')`);
        const voices = voiceRows.map((r: any) => ({ name: String(r.name), count: r.count }));

        const hourRows = await db
          .select({ hour: sql`HOUR(created_at)`, count: count() })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
          .groupBy(sql`HOUR(created_at)`);
        const activeHours = hourRows.map((r: any) => ({ hour: Number(r.hour), count: r.count }));

        const dailyRows = await db
          .select({ date: sql`DATE(created_at)`, count: count() })
          .from(ttsConversions)
          .where(sql`user_id = ${input.userId} AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
          .groupBy(sql`DATE(created_at)`)
          .orderBy(sql`DATE(created_at)`);
        const daily = dailyRows.map((r: any) => ({ date: String(r.date), count: r.count }));

        const recentLogs = await db
          .select()
          .from(ttsConversions)
          .where(eq(ttsConversions.userId, input.userId))
          .orderBy(desc(ttsConversions.createdAt))
          .limit(20);

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
            id: l.id, feature: l.feature, voice: l.voice, character: l.character,
            charCount: l.charCount, durationMs: l.durationMs,
            status: l.status || "success", errorMsg: l.errorMsg, createdAt: l.createdAt,
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "DB not available" };
      try {
        await db.update(errorLogs)
          .set({ resolved: true, resolvedAt: new Date() })
          .where(eq(errorLogs.id, input.errorId));
        return { success: true };
      } catch (e) {
        console.error("[resolveError]", e);
        return { success: false, message: "Failed to resolve error" };
      }
    }),

  dismissFailedGen: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "DB not available" };
      try {
        await db.delete(ttsConversions).where(eq(ttsConversions.id, input.id));
        return { success: true };
      } catch (e) {
        console.error("[dismissFailedGen]", e);
        return { success: false, message: "Failed to dismiss" };
      }
    }),

  deleteAllFailedGens: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false, message: "DB not available" };
      try {
        await db.delete(ttsConversions).where(eq(ttsConversions.status, "fail"));
        return { success: true };
      } catch (e) {
        console.error("[deleteAllFailedGens]", e);
        return { success: false, message: "Failed to dismiss all" };
      }
    }),

  deleteSystemLog: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "DB not available" };
      try {
        await db.delete(errorLogs).where(eq(errorLogs.id, input.id));
        return { success: true };
      } catch (e) {
        console.error("[deleteSystemLog]", e);
        return { success: false, message: "Failed to delete log" };
      }
    }),

  resolveAllErrors: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false, message: "DB not available" };
      try {
        await db.update(errorLogs).set({ resolved: true, resolvedAt: new Date() });
        return { success: true };
      } catch (e) {
        console.error("[resolveAllErrors]", e);
        return { success: false, message: "Failed to resolve all errors" };
      }
    }),

  deleteAllSystemLogs: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false, message: "DB not available" };
      try {
        await db.delete(errorLogs);
        return { success: true };
      } catch (e) {
        console.error("[deleteAllSystemLogs]", e);
        return { success: false, message: "Failed to delete all logs" };
      }
    }),
});
