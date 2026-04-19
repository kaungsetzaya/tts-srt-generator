/**
 * Admin Router — user management, subscriptions, analytics
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t, adminProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, subscriptions, ttsConversions, creditTransactions } from "../../drizzle/schema";
import { eq, count, sql } from "drizzle-orm";

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

      const existingSubs = await db
        .select()
        .from(subscriptions)
        .where(sql`user_id = ${input.userId} AND expires_at > NOW()`)
        .limit(1);

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

  getAnalytics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      return { totalUsers: 0, activeSubs: 0, totalConversions: 0, revenue: 0, planCounts: [] };
    try {
      const PLAN_PRICE: Record<string, number> = {
        trial: 0, starter: 5000, creator: 15000, pro: 30000,
      };

      const [totalUsersRow] = await db.select({ count: count() }).from(users);
      const [activeSubsRow] = await db
        .select({ count: count() })
        .from(subscriptions)
        .where(sql`expires_at > NOW()`);
      const [totalConvRow] = await db.select({ count: count() }).from(ttsConversions);
      const planRows = await db
        .select({ plan: subscriptions.plan, count: count() })
        .from(subscriptions)
        .where(sql`payment_method IS NOT NULL AND payment_method != 'free' AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`)
        .groupBy(subscriptions.plan);

      const revenue = planRows.reduce(
        (sum: number, p: any) => sum + (PLAN_PRICE[p.plan] ?? 0) * p.count,
        0
      );

      const allPlanRows = await db
        .select({ plan: subscriptions.plan, count: count() })
        .from(subscriptions)
        .groupBy(subscriptions.plan);

      return {
        totalUsers: totalUsersRow?.count || 0,
        activeSubs: activeSubsRow?.count || 0,
        totalConversions: totalConvRow?.count || 0,
        revenue,
        planCounts: allPlanRows,
      };
    } catch {
      return { totalUsers: 0, activeSubs: 0, totalConversions: 0, revenue: 0, planCounts: [] };
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
});
