/**
 * Credit management helpers Ã¢â‚¬â€ atomic deduction and addition.
 * Used by TTS, video, dub, and admin routers.
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { users, creditTransactions } from "../../shared/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Atomically check balance and deduct credits within a single DB transaction.
 * Prevents double-spend under concurrent requests.
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
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const currentCredits = user.credits ?? 0;
      if (currentCredits < amount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient credits. Need ${amount}, have ${currentCredits}`,
        });
      }

      await tx
        .update(users)
        .set({ credits: currentCredits - amount })
        .where(eq(users.id, userId));

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
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) throw new Error("User not found");

      const currentCredits = user.credits ?? 0;
      await tx
        .update(users)
        .set({ credits: currentCredits + amount })
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
