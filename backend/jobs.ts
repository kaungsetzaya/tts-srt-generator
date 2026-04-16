// Background job system for long-running tasks like video dubbing
import { DubOptions, DubResult } from "@shared/types";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  type: "dub_file" | "dub_link";
  status: JobStatus;
  progress: number;
  message: string;
  input: any;
  result?: DubResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobs = new Map<string, Job>();

const MAX_CONCURRENT = 2;
let activeJobs = 0;
const waitingQueue: Array<() => void> = [];

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

export function createJob(type: "dub_file" | "dub_link", input: any): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  jobs.set(id, { id, type, status: "pending", progress: 0, message: "Job queued", input, createdAt: new Date(), updatedAt: new Date() });
  return id;
}

export function getJob(id: string): Job | undefined { return jobs.get(id); }

export function updateJob(id: string, updates: Partial<Pick<Job, "status" | "progress" | "message" | "result" | "error">>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, updates, { updatedAt: new Date() });
}

export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) { if (job.updatedAt < oneHourAgo) jobs.delete(id); }
}

if (typeof setInterval !== "undefined") { setInterval(cleanupOldJobs, 10 * 60 * 1000); }
