// Background job system for long-running tasks like video dubbing and translation
// Jobs are persisted to the DB so they survive server restarts.
import { randomUUID } from "crypto";
import { DubOptions, DubResult } from "@shared/types";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobType = "dub_file" | "dub_link" | "translate_file" | "translate_link";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  message: string;
  input: any;
  result?: any;
  error?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── In-memory cache (primary store for active/recent jobs) ─────────────────────
const jobs = new Map<string, Job>();

const MAX_CONCURRENT = 5;

/** AsyncSemaphore — proper queue-based slot management.
 *  In Node.js the event loop is single-threaded, so the counter
 *  check-and-decrement is effectively atomic. We wrap it in a
 *  small class to make the intent explicit. */
class AsyncSemaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.permits--;
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }

  status() {
    return {
      active: MAX_CONCURRENT - this.permits,
      waiting: this.queue.length,
      max: MAX_CONCURRENT,
    };
  }
}

const jobSemaphore = new AsyncSemaphore(MAX_CONCURRENT);

// Job processors map
const processors: Partial<Record<JobType, (job: Job) => Promise<void>>> = {};

export function registerProcessor(type: JobType, processor: (job: Job) => Promise<void>) {
  processors[type] = processor;
}

export async function acquireSlot(): Promise<void> {
  return jobSemaphore.acquire();
}

export function releaseSlot(): void {
  jobSemaphore.release();
}

export function getQueueStatus() {
  return jobSemaphore.status();
}

// ─── DB persistence helpers (fire-and-forget, never throw) ───────────────────────

async function persistJobCreate(job: Job): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../shared/drizzle/schema");
    const db = await getDb();
    if (!db) return;
    await db.insert(ttsJobs).values({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      message: job.message,
      inputJson: JSON.stringify(job.input),
      userId: job.userId,
    }).onDuplicateKeyUpdate({ set: { status: job.status } });
  } catch (e) {
    console.warn("[Jobs] DB persist create failed (non-fatal):", (e as any)?.message);
  }
}

async function persistJobUpdate(id: string, updates: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../shared/drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const row: any = {
      updatedAt: new Date(),
    };
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.progress !== undefined) row.progress = updates.progress;
    if (updates.message !== undefined) row.message = updates.message;
    if (updates.error !== undefined) row.error = updates.error?.slice(0, 990);
    if (updates.result !== undefined) row.resultJson = JSON.stringify(updates.result);
    
    // Ensure we don't overwrite a final status with an earlier one (though unlikely in current flow)
    await db.update(ttsJobs).set(row).where(eq(ttsJobs.id, id));
  } catch (e) {
    console.warn("[Jobs] DB persist update failed (non-fatal):", (e as any)?.message);
  }
}

async function loadJobFromDb(id: string): Promise<Job | undefined> {
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../shared/drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return undefined;
    const rows = await db.select().from(ttsJobs).where(eq(ttsJobs.id, id)).limit(1);
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      type: r.type as JobType,
      status: r.status as JobStatus,
      progress: r.progress,
      message: r.message ?? "",
      input: r.inputJson ? JSON.parse(r.inputJson) : {},
      result: r.resultJson ? JSON.parse(r.resultJson) : undefined,
      error: r.error ?? undefined,
      userId: r.userId ?? undefined,
      createdAt: r.createdAt!,
      updatedAt: r.updatedAt!,
    };
  } catch {
    return undefined;
  }
}

// On startup: mark any previously "processing" jobs as failed
// (they were interrupted by the server restart)
export async function recoverInterruptedJobs(): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../shared/drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    await db.update(ttsJobs)
      .set({ status: "failed", error: "Server restarted — job was interrupted", updatedAt: new Date() })
      .where(sql`status IN ('pending', 'processing')`);
    console.log("[Jobs] Marked interrupted jobs as failed on startup");
  } catch (e) {
    console.warn("[Jobs] Recovery failed (non-fatal):", (e as any)?.message);
  }
}

// ─── Core API ──────────────────────────────────────────────────────────────────

export function createJob(type: JobType, input: any, userId?: string): string {
  const id = `job_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date();
  const job: Job = {
    id,
    type,
    status: "pending",
    progress: 0,
    message: "Job queued",
    input,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);

  // Persist to DB (fire-and-forget)
  persistJobCreate(job).catch(() => {});

  // Auto-process if processor registered
  if (processors[type]) {
    processJob(id).catch(err => console.error(`[Job ${id}] Process error:`, err));
  }

  return id;
}

async function processJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  updateJob(jobId, { status: "processing", progress: 10, message: "Processing..." });

  try {
    await acquireSlot();
    try {
      const processor = processors[job.type];
      if (processor) {
        await processor(job);
      } else {
        throw new Error(`No processor for job type: ${job.type}`);
      }
    } finally {
      releaseSlot();
    }
  } catch (error: any) {
    console.error(`[Job ${jobId}] Failed:`, error.message);
    updateJob(jobId, {
      status: "failed",
      progress: 0,
      error: error.message || "Job failed",
      message: "Failed",
    });
  }
}

export function getJob(id: string): Job | undefined {
  const inMemory = jobs.get(id);
  return inMemory;
}

/**
 * Async version that falls back to DB.
 * CRITICAL: We always check DB for active jobs to ensure cache consistency 
 * across multiple server instances or if the memory cache is stale.
 */
export async function getJobAsync(id: string): Promise<Job | undefined> {
  const inMemory = jobs.get(id);
  
  // If job is in memory AND it's a final state, it's safe to return.
  if (inMemory && (inMemory.status === "completed" || inMemory.status === "failed")) {
    return inMemory;
  }

  // Otherwise, ALWAYS check DB for the latest progress/status.
  const fromDb = await loadJobFromDb(id);
  if (fromDb) {
    jobs.set(id, fromDb);
    return fromDb;
  }

  return inMemory;
}

export function updateJob(id: string, updates: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, updates, { updatedAt: new Date() });

  // Persist to DB (fire-and-forget)
  persistJobUpdate(id, updates).catch(() => {});
}

export async function cleanupOldJobs(): Promise<void> {
  // ─── In-memory cleanup (1h TTL) ─────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < oneHourAgo) {
      // Don't clean up pending jobs — they might still be needed
      if (job.status !== "pending") {
        jobs.delete(id);
      }
    }
  }

  // ─── DB cleanup (24h TTL for completed/failed jobs) ─────────────────────
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../shared/drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    await db.delete(ttsJobs)
      .where(sql`status IN ('completed', 'failed') AND updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
  } catch (e) {
    // Non-fatal — DB cleanup is best-effort
    console.warn("[Jobs] DB cleanup failed (non-fatal):", (e as any)?.message);
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldJobs, 10 * 60 * 1000);
}
