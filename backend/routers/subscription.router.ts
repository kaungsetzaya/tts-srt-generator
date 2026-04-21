/**
 * Subscription Router — user subscription status
 */
import { t } from "./trpc";
import { getDb } from "../db";
import { users, subscriptions } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export const subscriptionRouter = t.router({
  myStatus: t.procedure.query(async ({ ctx }) => {
    if (!ctx.user) return { active: false, plan: null, credits: 0, expiresAt: null, renewsAt: null };
    const db = await getDb();
    if (!db) return { active: false, plan: null, credits: 0, expiresAt: null, renewsAt: null };
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user!.userId))
        .limit(1);
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(sql`user_id = ${ctx.user!.userId} AND expires_at > NOW()`)
        .orderBy(sql`created_at DESC`)
        .limit(1);
      return sub
        ? {
            active: true,
            plan: sub.plan,
            expiresAt: sub.expiresAt,
            renewsAt: null,
            credits: user?.credits ?? 0,
          }
        : { active: false, plan: null, expiresAt: null, renewsAt: null, credits: user?.credits ?? 0 };
    } catch {
      return { active: false, plan: null, credits: 0, expiresAt: null, renewsAt: null };
    }
  }),
});
