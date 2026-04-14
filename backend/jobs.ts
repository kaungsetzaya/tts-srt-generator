// Background job system for long-running tasks like video dubbing
import { DubOptions, DubResult } from "@shared/types";

// Job status
export type JobStatus = "pending" | "processing" | "completed" | "failed";

// Job entry
export interface Job {
  id: string;
  type: "dub_file" | "dub_link";
  status: JobStatus;
  progress: number; // 0-100
  message: string;
  input: any;
  result?: DubResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job store (use Redis in production)
const jobs = new Map<string, Job>();

// Create a new job
export function createJob(type: "dub_file" | "dub_link", input: any): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  jobs.set(id, {
    id,
    type,
    status: "pending",
    progress: 0,
    message: "Job queued",
    input,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

// Get job status
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

// Update job progress
export function updateJob(id: string, updates: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>): void {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates, { updatedAt: new Date() });
  }
}

// Clean up old jobs (older than 1 hour)
export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}

// Clean up every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldJobs, 10 * 60 * 1000);
}
