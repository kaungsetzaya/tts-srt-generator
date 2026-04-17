// Background job system for long-running tasks like video dubbing and translation
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

const jobs = new Map<string, Job>();

const MAX_CONCURRENT = 2;
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

export function createJob(type: JobType, input: any, userId?: string): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  jobs.set(id, { 
    id, 
    type, 
    status: "pending", 
    progress: 0, 
    message: "Job queued", 
    input, 
    userId,
    createdAt: new Date(), 
    updatedAt: new Date() 
  });
  
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
      message: "Failed"
    });
  }
}

export function getJob(id: string): Job | undefined { return jobs.get(id); }

export function updateJob(id: string, updates: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, updates, { updatedAt: new Date() });
}

export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) { 
    if (job.updatedAt < oneHourAgo) {
      // Don't clean up pending jobs - they might still be needed
      if (job.status !== "pending") {
        jobs.delete(id);
      }
    }
  }
}

if (typeof setInterval !== "undefined") { setInterval(cleanupOldJobs, 10 * 60 * 1000); }
