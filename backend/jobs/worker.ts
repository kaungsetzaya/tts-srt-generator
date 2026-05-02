/**
 * BullMQ Worker — processes video-tasks with Upstash Redis
 * Throttled progress updates (5s) to stay within free tier limits
 */
import { Worker, Job as BullMQJob } from "bullmq";
import { Redis } from "ioredis";
import { ENV } from "../_core/env";
import { getVideoQueue } from "./queue";
import { updateJob, registerBullMQJob, unregisterBullMQJob } from "../jobs";
import { dubVideoPipeline } from "../src/modules/dubbing/pipelines/dubVideo.pipeline";
import { translateVideoPipeline } from "../src/modules/translation/pipelines/translateVideo.pipeline";
import { generateSignedDownloadUrl } from "../_core/signedUrl";
import { r2Service, r2Key } from "../src/modules/media/services/r2.service";
import { recordConversion } from "../src/modules/_core/stats";
import { buildOutputFilename } from "../src/modules/_core/filename";
import * as path from "path";
import { promises as fs } from "fs";

const redisUrl = ENV.redisUrl;
let worker: Worker | null = null;

// Track last progress update per job for throttling
const lastProgressUpdate = new Map<string, number>();

import { safeRefund } from "../src/modules/_core/processors/shared";

async function throttledUpdateProgress(job: BullMQJob, progress: number, message: string) {
  const last = lastProgressUpdate.get(job.id!) || 0;
  const now = Date.now();
  if (now - last >= 5000 || progress === 0 || progress === 100) {
    await job.updateProgress({ progress, message });
    lastProgressUpdate.set(job.id!, now);
  }
}

async function processDubFile(job: BullMQJob) {
  const { tempFilePath, filename, userId, ...options } = job.data;
  try {
    await throttledUpdateProgress(job, 10, "Reading uploaded file...");
    const buffer = await fs.readFile(tempFilePath);

    await throttledUpdateProgress(job, 20, "Extracting audio & transcribing...");
    const result = await dubVideoPipeline.execute(buffer, filename, options, job.id!);

    await throttledUpdateProgress(job, 70, "Uploading result...");
    if (result.filename) {
      const localPath = path.join(process.cwd(), "static", "downloads", result.filename);
      result.videoUrl = await generateSignedDownloadUrl(result.filename);

      if (r2Service.isEnabled() && userId) {
        try {
          const videoKey = r2Key("video", result.filename, userId);
          await r2Service.uploadFromPath(videoKey, localPath, "video/mp4");
          result.videoUrl = await generateSignedDownloadUrl(result.filename, userId, "video");
          await fs.unlink(localPath).catch(() => {});
        } catch (r2Err: any) {
          console.error(`[Job ${job.id}] R2 video upload failed, keeping local file:`, r2Err.message);
        }

        if (result.srtContent && result.shortId) {
          const srtFilename = buildOutputFilename(result.shortId, "SRT", "srt");
          try {
            const srtKey = r2Key("subtitle", srtFilename, userId);
            await r2Service.uploadFile(srtKey, Buffer.from(result.srtContent, "utf-8"), "text/plain; charset=utf-8");
            (result as any).srtUrl = await generateSignedDownloadUrl(srtFilename, userId, "subtitle");
          } catch (r2Err: any) {
            console.error(`[Job ${job.id}] R2 subtitle upload failed:`, r2Err.message);
          }
        }
      }
    }

    await throttledUpdateProgress(job, 100, "Completed");
    updateJob(job.id!, { status: "completed", progress: 100, result, message: "Completed" });

    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "dub_file",
      voice: options.voice,
      text: result.myanmarText,
      durationMs: result.durationMs,
      status: "success",
    });

    // Clean up temp upload file only after full success (retries need it)
    await fs.unlink(tempFilePath).catch(() => {});

    return result;
  } catch (err: any) {
    console.error(`[Job ${job.id}] Dub file failed:`, err);
    if (userId) await safeRefund(job.id!, userId, 10, "video_dub_refund", "Refund: Dub job failed");
    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "dub_file",
      status: "fail",
      errorMsg: err.message,
    });
    throw err;
  }
}

async function processDubLink(job: BullMQJob) {
  const { url, userId, ...options } = job.data;
  try {
    await throttledUpdateProgress(job, 10, "Downloading video...");
    const result = await dubVideoPipeline.executeFromLink(url, options, job.id!);

    await throttledUpdateProgress(job, 70, "Uploading result...");
    if (result.filename) {
      const localPath = path.join(process.cwd(), "static", "downloads", result.filename);
      result.videoUrl = await generateSignedDownloadUrl(result.filename);

      if (r2Service.isEnabled() && userId) {
        try {
          const videoKey = r2Key("video", result.filename, userId);
          await r2Service.uploadFromPath(videoKey, localPath, "video/mp4");
          result.videoUrl = await generateSignedDownloadUrl(result.filename, userId, "video");
          await fs.unlink(localPath).catch(() => {});
        } catch (r2Err: any) {
          console.error(`[Job ${job.id}] R2 video upload failed, keeping local file:`, r2Err.message);
        }

        if (result.srtContent && result.shortId) {
          const srtFilename = buildOutputFilename(result.shortId, "SRT", "srt");
          try {
            const srtKey = r2Key("subtitle", srtFilename, userId);
            await r2Service.uploadFile(srtKey, Buffer.from(result.srtContent, "utf-8"), "text/plain; charset=utf-8");
            (result as any).srtUrl = await generateSignedDownloadUrl(srtFilename, userId, "subtitle");
          } catch (r2Err: any) {
            console.error(`[Job ${job.id}] R2 subtitle upload failed:`, r2Err.message);
          }
        }
      }
    }

    await throttledUpdateProgress(job, 100, "Completed");
    updateJob(job.id!, { status: "completed", progress: 100, result, message: "Completed" });

    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "dub_link",
      voice: options.voice,
      text: result.myanmarText,
      durationMs: result.durationMs,
      status: "success",
    });

    return result;
  } catch (err: any) {
    console.error(`[Job ${job.id}] Dub link failed:`, err);
    if (userId) await safeRefund(job.id!, userId, 10, "video_dub_refund", "Refund: Dub link job failed");
    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "dub_link",
      status: "fail",
      errorMsg: err.message,
    });
    throw err;
  }
}

async function processTranslateFile(job: BullMQJob) {
  const { tempFilePath, filename, userId, userApiKey } = job.data;
  try {
    await throttledUpdateProgress(job, 10, "Reading uploaded file...");
    const buffer = await fs.readFile(tempFilePath);

    await throttledUpdateProgress(job, 20, "Extracting audio & translating...");
    const result = await translateVideoPipeline.execute(buffer, filename, userApiKey, job.id!);

    await throttledUpdateProgress(job, 100, "Completed");
    updateJob(job.id!, { status: "completed", progress: 100, result, message: "Completed" });

    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "video_upload",
      text: result.myanmarText,
      status: "success",
    });

    // Clean up temp upload file only after full success (retries need it)
    await fs.unlink(tempFilePath).catch(() => {});

    return result;
  } catch (err: any) {
    if (userId) await safeRefund(job.id!, userId, 5, "video_translate_refund", "Refund: Translate job failed");
    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "video_upload",
      status: "fail",
      errorMsg: err.message,
    });
    throw err;
  }
}

async function processTranslateLink(job: BullMQJob) {
  const { url, userId, userApiKey } = job.data;
  try {
    await throttledUpdateProgress(job, 10, "Downloading & translating...");
    const result = await translateVideoPipeline.executeFromLink(url, userApiKey, job.id!);

    await throttledUpdateProgress(job, 100, "Completed");
    updateJob(job.id!, { status: "completed", progress: 100, result, message: "Completed" });

    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "video_link",
      text: result.myanmarText,
      status: "success",
    });

    return result;
  } catch (err: any) {
    console.error(`[Job ${job.id}] Translate link failed:`, err);
    if (userId) await safeRefund(job.id!, userId, 5, "video_translate_refund", "Refund: Translate link job failed");
    await recordConversion({
      jobId: job.id!,
      userId,
      feature: "video_link",
      status: "fail",
      errorMsg: err.message,
    });
    throw err;
  }
}

export function createWorker(): Worker | null {
  if (worker) return worker;
  if (!redisUrl) {
    console.warn("[BullMQ] REDIS_URL not set — worker not started (using in-memory processors)");
    return null;
  }

  try {
    const redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    worker = new Worker(
      "video-tasks",
      async (job) => {
        // Register this BullMQ job so updateJob() can map to it
        registerBullMQJob(job.id!, job);
        lastProgressUpdate.set(job.id!, 0);

        try {
          await throttledUpdateProgress(job, 5, "Queued — waiting for slot...");
          const type = job.name as string;

          switch (type) {
            case "dub_file":
              return await processDubFile(job);
            case "dub_link":
              return await processDubLink(job);
            case "translate_file":
              return await processTranslateFile(job);
            case "translate_link":
              return await processTranslateLink(job);
            default:
              throw new Error(`Unknown job type: ${type}`);
          }
        } finally {
          unregisterBullMQJob(job.id!);
          lastProgressUpdate.delete(job.id!);
        }
      },
      {
        connection: redisConnection,
        concurrency: 3,
        lockDuration: 30000,
        stalledInterval: 300000,
        drainDelay: 10,
        limiter: {
          max: 3,
          duration: 1000,
        },
      }
    );

    worker.on("completed", (job) => {
      console.log(`[BullMQ] Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[BullMQ] Job ${job?.id} failed:`, err.message);
      if (job) {
        updateJob(job.id!, {
          status: "failed",
          progress: 0,
          error: err.message,
          message: "Failed",
        });
      }
    });

    console.log("[BullMQ] Worker started (concurrency: 3)");
    return worker;
  } catch (err: any) {
    console.error("[BullMQ] Failed to start worker:", err.message);
    return null;
  }
}

export function getWorker(): Worker | null {
  return worker;
}


