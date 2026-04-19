// Background job system for long-running tasks like video dubbing and translation
// Jobs are persisted to the DB so they survive server restarts.
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

// ─── In-memory cache (primary store for active/recent jobs) ─────
const jobs = new Map<string, Job>();

const MAX_CONCURRENT = 5;
let activeJobs = 0;
const waitingQueue: Array<() => void> = [];

// Job processors map
const processors: Partial<Record<JobType, (job: Job) => Promise<void>>> = {};

export function registerProcessor(type: JobType, processor: (job: Job) => Promise<void>) {
  processors[type] = processor;
}

export async function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT) { activeJobs++; return; }
  await new Promise<void>((resolve) => waitingQueue.push(resolve));
  activeJobs++;
}

export function releaseSlot(): void {
  activeJobs--;
  if (waitingQueue.length > 0) { const next = waitingQueue.shift(); next?.(); }
}

export function getQueueStatus() {
  return { active: activeJobs, waiting: waitingQueue.length, max: MAX_CONCURRENT };
}

// ─── DB persistence helpers (fire-and-forget, never throw) ───────

async function persistJobCreate(job: Job): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../drizzle/schema");
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
    const { ttsJobs } = await import("../drizzle/schema");
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
    await db.update(ttsJobs).set(row).where(eq(ttsJobs.id, id));
  } catch (e) {
    console.warn("[Jobs] DB persist update failed (non-fatal):", (e as any)?.message);
  }
}

async function loadJobFromDb(id: string): Promise<Job | undefined> {
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../drizzle/schema");
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
    const { ttsJobs } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const updated = await db.update(ttsJobs)
      .set({ status: "failed", error: "Server restarted — job was interrupted", updatedAt: new Date() })
      .where(sql`status IN ('pending', 'processing')`);
    console.log("[Jobs] Marked interrupted jobs as failed on startup");
  } catch (e) {
    console.warn("[Jobs] Recovery failed (non-fatal):", (e as any)?.message);
  }
}

// ─── Core API ────────────────────────────────────────────────────

export function createJob(type: JobType, input: any, userId?: string): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
  // Check in-memory first
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;

  // For completed/recent jobs not in memory: caller must await getJobAsync
  // Return undefined synchronously — callers that need DB fallback use getJobAsync
  return undefined;
}

// Async version that falls back to DB for jobs not in memory (e.g. after restart)
export async function getJobAsync(id: string): Promise<Job | undefined> {
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;

  // Fall back to DB
  const fromDb = await loadJobFromDb(id);
  if (fromDb) {
    // Repopulate memory cache for future calls
    jobs.set(id, fromDb);
    return fromDb;
  }
  return undefined;
}

export function updateJob(id: string, updates: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, updates, { updatedAt: new Date() });

  // Persist to DB (fire-and-forget)
  persistJobUpdate(id, updates).catch(() => {});
}

export async function cleanupOldJobs(): Promise<void> {
  // ─── In-memory cleanup (1h TTL) ─────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < oneHourAgo) {
      // Don't clean up pending jobs — they might still be needed
      if (job.status !== "pending") {
        jobs.delete(id);
      }
    }
  }

  // ─── DB cleanup (24h TTL for completed/failed jobs) ─────
  try {
    const { getDb } = await import("./db");
    const { ttsJobs } = await import("../drizzle/schema");
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
