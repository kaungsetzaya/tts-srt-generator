/**
 * BullMQ Queue Setup — 'video-tasks' queue backed by Upstash Redis
 * Optimized for Upstash free tier: enableReadyCheck disabled to save requests
 */
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { ENV } from "../_core/env";

const redisUrl = ENV.redisUrl;

let videoQueue: Queue | null = null;
let redisConnection: Redis | null = null;

export function getVideoQueue(): Queue | null {
  return videoQueue;
}

export function getRedisConnection(): Redis | null {
  return redisConnection;
}

export function isBullMQEnabled(): boolean {
  return videoQueue !== null;
}

export function initVideoQueue(): Queue | null {
  if (videoQueue) return videoQueue;
  if (!redisUrl) {
    console.warn("[BullMQ] REDIS_URL not set — falling back to in-memory job system");
    return null;
  }

  try {
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisConnection.on("error", (err) => {
      console.error("[BullMQ] Redis connection error:", err.message);
    });

    redisConnection.on("connect", () => {
      console.log("[BullMQ] Redis connected");
    });

    videoQueue = new Queue("video-tasks", {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 50, age: 86400 },
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
      // Worker-specific settings (lockDuration, stalledInterval) are set in worker.ts
    });

    console.log("[BullMQ] video-tasks queue initialized");
    return videoQueue;
  } catch (err: any) {
    console.error("[BullMQ] Failed to initialize queue:", err.message);
    return null;
  }
}
