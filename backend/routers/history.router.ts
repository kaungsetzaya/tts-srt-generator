/**
 * History Router — user generation and credit history
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { getDb } from "../db";
import { ttsConversions, creditTransactions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const historyRouter = t.router({
  getMyHistory: t.procedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      try {
        const rows = await db
          .select()
          .from(ttsConversions)
          .where(eq(ttsConversions.userId, ctx.user.userId))
          .orderBy(desc(ttsConversions.createdAt))
          .limit(100);
        return rows;
      } catch {
        return [];
      }
    }),

  getCreditHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const txs = await db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, ctx.user!.userId))
          .orderBy(desc(creditTransactions.createdAt))
          .limit(input.limit);
        return txs.map((row: typeof txs[0]) => ({
          id: row.id,
          amount: row.amount,
          type: row.type,
          description: row.description,
          createdAt: row.createdAt,
        }));
      } catch {
        return [];
      }
    }),
});
