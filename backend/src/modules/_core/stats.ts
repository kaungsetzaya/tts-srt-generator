import { randomUUID } from "crypto";
import { getDb } from "../../../db";
import { ttsConversions } from "../../../../shared/drizzle/schema";

// Track which jobs have already been recorded to prevent duplicate analytics rows on retries
const recordedConversions = new Set<string>();

// Periodically clean up to prevent unbounded memory growth
setInterval(() => {
  const before = recordedConversions.size;
  recordedConversions.clear();
  if (before > 0) {
    console.log(`[Stats] Cleaned up ${before} recorded conversion entries`);
  }
}, 60 * 60 * 1000); // every 1 hour

export interface ConversionRecord {
    userId?: string;
    feature: "tts" | "video_upload" | "video_link" | "dub_file" | "dub_link";
    voice?: string;
    character?: string;
    text?: string;
    inputText?: string;
    charCount?: number;
    durationMs?: number;
    videoDurationSec?: number;
    aspectRatio?: string;
    status: "success" | "fail";
    errorMsg?: string;
}

/**
 * Records a completed or failed task in the tts_conversions table
 * for analytics and dashboard display.
 * Deduplicated by jobId to prevent duplicate rows on BullMQ retries.
 */
export async function recordConversion(data: ConversionRecord & { jobId?: string }) {
    const key = data.jobId ? `${data.jobId}_${data.status}` : randomUUID();
    if (data.jobId && recordedConversions.has(key)) {
        console.log(`[Stats] Skipping duplicate conversion record for job ${data.jobId}`);
        return;
    }
    if (data.jobId) recordedConversions.add(key);

    try {
        const db = await getDb();
        if (!db) return;

        await db.insert(ttsConversions).values({
            id: randomUUID(),
            userId: data.userId,
            feature: data.feature,
            voice: data.voice,
            character: data.character,
            text: data.text,
            inputText: data.inputText,
            charCount: data.charCount ?? 0,
            durationMs: data.durationMs ?? 0,
            videoDurationSec: data.videoDurationSec ?? 0,
            aspectRatio: data.aspectRatio,
            status: data.status,
            errorMsg: data.errorMsg?.slice(0, 490),
        });
    } catch (e) {
        console.error("[Stats] Failed to record conversion:", e);
    }
}
