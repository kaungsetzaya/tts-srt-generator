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

  getUnifiedHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const limit = input.limit ?? 50;
        
        // Fetch tasks
        const tasks = await db
          .select()
          .from(ttsConversions)
          .where(eq(ttsConversions.userId, ctx.user!.userId))
          .orderBy(desc(ttsConversions.createdAt))
          .limit(limit);

        // Fetch credit transactions
        const credits = await db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, ctx.user!.userId))
          .orderBy(desc(creditTransactions.createdAt))
          .limit(limit);

        // Combine and map to a unified shape
        const unified = [
          ...tasks.map(t => ({
            id: t.id,
            origin: "task" as const,
            type: t.feature || "tts",
            amount: 0,
            status: t.status,
            description: t.text?.slice(0, 100) || t.errorMsg || "",
            createdAt: t.createdAt!,
          })),
          ...credits.map(c => ({
            id: c.id,
            origin: "credit" as const,
            type: c.type,
            amount: c.amount,
            status: "success",
            description: c.description || "",
            createdAt: c.createdAt!,
          }))
        ];

        // Sort by date desc
        return unified.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
      } catch (e) {
        console.error("[getUnifiedHistory Error]", e);
        return [];
      }
    }),
});
