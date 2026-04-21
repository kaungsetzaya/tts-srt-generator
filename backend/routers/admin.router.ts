/**
 * Admin Router — user management, subscriptions, analytics
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t, adminProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, subscriptions, ttsConversions, creditTransactions } from "../../drizzle/schema";
import { eq, count, sql, desc, and, gt } from "drizzle-orm";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

export const adminRouter = t.router({
  getUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const userList = await db.select().from(users).limit(500);
      const allSubs = await db
        .select()
        .from(subscriptions)
        .where(sql`expires_at > NOW()`);
      const allGenCounts = await db
        .select({ userId: ttsConversions.userId, count: count() })
        .from(ttsConversions)
        .groupBy(ttsConversions.userId);

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
        paymentSlip: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const planCredits: Record<string, number> = {
        trial: 15,
        starter: 50,
        creator: 200,
        pro: 500,
      };
      const creditsToAdd = planCredits[input.plan] ?? 10;

      // Use a more robust check: any active sub or the latest sub (even if expired)
      const existingSubs = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, input.userId))
        .orderBy(desc(subscriptions.expiresAt))
        .limit(1);

      if (existingSubs.length > 0) {
        const existing = existingSubs[0];
        const now = new Date();
        const currentExpires = existing.expiresAt && existing.expiresAt > now 
          ? new Date(existing.expiresAt) 
          : now;
          
        const newExpires = new Date(
          currentExpires.getTime() + input.days * 86400000
        );
        
        await db
          .update(subscriptions)
          .set({
            expiresAt: newExpires,
            plan: input.plan,
            note: input.note || existing.note,
            paymentMethod: input.paymentMethod || existing.paymentMethod,
            paymentSlip: input.paymentSlip || existing.paymentSlip,
          })
          .where(eq(subscriptions.id, existing.id));
      } else {
        await db.insert(subscriptions).values({
          id: randomUUID(),
          userId: input.userId,
          plan: input.plan,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + input.days * 86400000),
          note: input.note,
          paymentMethod: input.paymentMethod ?? null,
          paymentSlip: input.paymentSlip ?? null,
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
          description: `Subscribe: ${input.plan} plan (${input.days} days added)`,
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
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (user && user.credits && user.credits > 0) {
        await db.update(users).set({ credits: 0 }).where(eq(users.id, input.userId));
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
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  getAnalytics: adminProcedure
    .input(z.object({ month: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return { totalUsers: 0, activeSubs: 0, totalConversions: 0, ttsCount: 0, videoCount: 0, revenue: 0, planCounts: [] };
      try {
        const PLAN_PRICE: Record<string, number> = {
          trial: 0, starter: 15000, creator: 35000, pro: 75000,
        };

        const targetMonth = input?.month || new Date().toISOString().slice(0, 7); // e.g. "2024-04"

        const [totalUsersRow] = await db.select({ count: count() }).from(users);
        const [activeSubsRow] = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(sql`expires_at > NOW()`);
          
        const [totalConvRow] = await db.select({ count: count() }).from(ttsConversions)
          .where(sql`DATE_FORMAT(created_at, '%Y-%m') = ${targetMonth}`);

        const featureCounts = await db
          .select({ feature: ttsConversions.feature, count: count() })
          .from(ttsConversions)
          .where(sql`DATE_FORMAT(created_at, '%Y-%m') = ${targetMonth}`)
          .groupBy(ttsConversions.feature);

        let ttsCount = 0;
        let videoCount = 0;
        featureCounts.forEach((f: any) => {
          if (f.feature === "tts") ttsCount = f.count;
          else if (f.feature === "video_link" || f.feature === "video_upload") videoCount += f.count;
        });

        const planRows = await db
          .select({ plan: subscriptions.plan, count: count() })
          .from(subscriptions)
          .where(and(
            sql`payment_method IS NOT NULL AND payment_method != 'free'`,
            sql`DATE_FORMAT(created_at, '%Y-%m') = ${targetMonth}`
          ))
          .groupBy(subscriptions.plan);

        const revenue = planRows.reduce(
          (sum: number, p: any) => sum + (PLAN_PRICE[p.plan] ?? 0) * p.count,
          0
        );

        const allPlanRows = await db
          .select({ plan: subscriptions.plan, count: count() })
          .from(subscriptions)
          .where(sql`DATE_FORMAT(created_at, '%Y-%m') = ${targetMonth}`)
          .groupBy(subscriptions.plan);

        return {
          totalUsers: totalUsersRow?.count || 0,
          activeSubs: activeSubsRow?.count || 0,
          totalConversions: totalConvRow?.count || 0,
          ttsCount,
          videoCount,
          revenue,
          planCounts: allPlanRows,
        };
      } catch (e) {
        console.error("[getAnalytics Error]", e);
        return { totalUsers: 0, activeSubs: 0, totalConversions: 0, ttsCount: 0, videoCount: 0, revenue: 0, planCounts: [] };
      }
    }),

  getServerHealth: adminProcedure.query(async () => {
    const mem = process.memoryUsage();
    let disk = "—";
    try {
      const { stdout } = await execFileAsync("df", ["-h", "/"]);
      const lines = stdout.trim().split("\n");
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        disk = parts[2] || "—";
      }
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
  getTransactions: adminProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const transactions = await db
          .select({
            id: creditTransactions.id,
            userId: creditTransactions.userId,
            amount: creditTransactions.amount,
            type: creditTransactions.type,
            description: creditTransactions.description,
            createdAt: creditTransactions.createdAt,
            userName: users.telegramFirstName,
            userUsername: users.telegramUsername,
          })
          .from(creditTransactions)
          .leftJoin(users, eq(creditTransactions.userId, users.id))
          .where(input?.userId ? eq(creditTransactions.userId, input.userId) : sql`1=1`)
          .orderBy(desc(creditTransactions.createdAt))
          .limit(input?.userId ? 500 : 200);

      return transactions.map((t: any) => ({
        ...t,
        userName: t.userName || "Unknown",
        userUsername: t.userUsername || "anon",
      }));
    } catch (e) {
      console.error("[getTransactions Error]", e);
      return [];
    }
  }),
});
