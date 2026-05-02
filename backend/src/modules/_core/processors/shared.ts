/**
 * Shared processor utilities — safe refund deduplication
 */
import { addCredits } from "../../../../routers/credits";

export const refundedJobs = new Map<string, number>();

export async function safeRefund(jobId: string, userId: string, amount: number, type: string, reason: string) {
  if (refundedJobs.has(jobId)) {
    console.log(`[Credits] Skipping duplicate refund for job ${jobId} (memory)`);
    return;
  }

  try {
    const { getDb } = await import("../../../db");
    const { creditTransactions } = await import("../../../../shared/drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      const description = `${reason} (job:${jobId})`;
      const existing = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, userId),
            eq(creditTransactions.type, type),
            eq(creditTransactions.description, description)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        console.log(`[Credits] Skipping duplicate refund for job ${jobId} (db)`);
        refundedJobs.set(jobId, Date.now());
        return;
      }
      refundedJobs.set(jobId, Date.now());
      await addCredits(userId, amount, type, description);
      return;
    }
  } catch (e: any) {
    console.error(`[Credits] DB dedupe check failed for job ${jobId}:`, e.message);
  }

  refundedJobs.set(jobId, Date.now());
  await addCredits(userId, amount, type, `${reason} (job:${jobId})`);
}

// Cleanup: 24h entries only
setInterval(() => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let cleaned = 0;
  for (const [jobId, ts] of refundedJobs.entries()) {
    if (now - ts > DAY) {
      refundedJobs.delete(jobId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[Credits] Cleaned up ${cleaned} refunded job entries (remaining ${refundedJobs.size})`);
  }
}, 60 * 60 * 1000);
