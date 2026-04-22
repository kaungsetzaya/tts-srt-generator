/**
 * History Router Ã¢â‚¬â€ user generation and credit history
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { getDb } from "../db";
import { creditTransactions } from "../../shared/drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const historyRouter = t.router({
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
        
        // Fetch credit transactions - contains all deductions, refunds, and plan purchases
        const credits = await db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, ctx.user!.userId))
          .orderBy(desc(creditTransactions.createdAt))
          .limit(limit);

        // Map to unified shape with proper type labels
        // REFUND types are success (positive), TTS/DUB deductions are success, only actual failures = "fail"
        const unified = credits.map((c: typeof credits[0]) => {
          const isRefund = c.type === "REFUND" || c.type === "tts_refund";
          const status = isRefund ? "success" : (c.amount > 0 ? "success" : (c.type?.includes("FAIL") ? "fail" : "success"));
          return {
            id: c.id,
            origin: "credit" as const,
            type: c.type,
            amount: c.amount,
            status,
            voice: "",
            character: "",
            charCount: 0,
            durationMs: 0,
            description: c.description || "",
            createdAt: c.createdAt!,
          };
        });

        // Sort by date desc
        return unified.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
      } catch (e) {
        console.error("[getUnifiedHistory Error]", e);
        return [];
      }
    }),
});
