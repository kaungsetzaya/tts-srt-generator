/**
 * Credit management helpers Ã¢â‚¬â€ atomic deduction and addition.
 * Used by TTS, video, dub, and admin routers.
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { users, creditTransactions } from "../../shared/drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";

/**
 * Atomically check balance and deduct credits within a single DB statement.
 * Uses `credits - amount` with a WHERE clause to prevent double-spend
 * under concurrent requests (no read-then-write race).
 */
export async function deductCredits(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.transaction(async (tx: any) => {
      const result = await tx
        .update(users)
        .set({ credits: sql`credits - ${amount}` })
        .where(and(eq(users.id, userId), gte(users.credits, amount)));

      if (result.rowsAffected === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient credits. Need ${amount}.`,
        });
      }

      await tx.insert(creditTransactions).values({
        id: randomUUID(),
        userId,
        amount: -amount,
        type,
        description,
      });
    });

    return true;
  } catch (e: any) {
    if (e.code === "BAD_REQUEST" || e.code === "NOT_FOUND") throw e;
    console.error("[Credit Error]", e);
    return false;
  }
}

/**
 * Add credits to a user's balance (for refunds, subscriptions, trials).
 * Now also uses a transaction for consistency.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.transaction(async (tx: any) => {
      await tx
        .update(users)
        .set({ credits: sql`credits + ${amount}` })
        .where(eq(users.id, userId));

      await tx.insert(creditTransactions).values({
        id: randomUUID(),
        userId,
        amount,
        type,
        description,
      });
    });

    return true;
  } catch (e: any) {
    console.error("[Credit Add Error]", e);
    return false;
  }
}
