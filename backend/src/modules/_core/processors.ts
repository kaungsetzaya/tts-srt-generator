import { registerProcessor, updateJob } from "../../../jobs";
import { dubVideoPipeline } from "../dubbing/pipelines/dubVideo.pipeline";
import { translateVideoPipeline } from "../translation/pipelines/translateVideo.pipeline";
import { addCredits } from "../../../routers/credits";
import { generateSignedDownloadUrl } from "../../../_core/signedUrl";
import { r2Service, r2Key } from "../media/services/r2.service";
import { recordConversion } from "./stats";
import { buildOutputFilename } from "./filename";
import * as path from "path";
import { promises as fs } from "fs";

// Track which jobs have already been refunded to prevent double refunds
// Map<jobId, timestamp> — older than 24h entries are cleaned up
const refundedJobs = new Map<string, number>();

async function safeRefund(jobId: string, userId: string, amount: number, type: string, reason: string) {
  if (refundedJobs.has(jobId)) {
    console.log(`[Credits] Skipping duplicate refund for job ${jobId}`);
    return;
  }
  refundedJobs.set(jobId, Date.now());
  await addCredits(userId, amount, type, reason);
}

/**
 * Centrally registers all background job processors.
 * Wiring up jobs to the new modular Pipelines.
 */

export function registerAllProcessors() {
    // 1. Dub File Processor
    registerProcessor("dub_file", async (job) => {
        const { tempFilePath, filename, userId, ...options } = job.input;
        try {
            const buffer = await fs.readFile(tempFilePath);
            const result = await dubVideoPipeline.execute(buffer, filename, options, job.id);

            // Upload to R2 and sign the download URL before completing
            if (result.filename) {
                const localPath = path.join(process.cwd(), "static", "downloads", result.filename);
                result.videoUrl = await generateSignedDownloadUrl(result.filename);

                if (r2Service.isEnabled() && userId) {
                    try {
                        const videoKey = r2Key("video", result.filename, userId);
                        await r2Service.uploadFromPath(videoKey, localPath, "video/mp4");
                        result.videoUrl = await generateSignedDownloadUrl(result.filename, userId, "video");
                        await fs.unlink(localPath).catch(() => {});
                    } catch (r2Err) {
                        console.error(`[Job ${job.id}] R2 video upload failed, keeping local file:`, r2Err);
                    }

                    // Upload SRT if generated
                    if (result.srtContent && result.shortId) {
                        const srtFilename = buildOutputFilename(result.shortId, "SRT", "srt");
                        try {
                            const srtKey = r2Key("subtitle", srtFilename, userId);
                            await r2Service.uploadFile(srtKey, Buffer.from(result.srtContent, "utf-8"), "text/plain; charset=utf-8");
                            (result as any).srtUrl = await generateSignedDownloadUrl(srtFilename, userId, "subtitle");
                        } catch (r2Err) {
                            console.error(`[Job ${job.id}] R2 subtitle upload failed:`, r2Err);
                        }
                    }
                }
            }

            console.log(`[Job ${job.id}] Dub file successful: ${result.videoUrl}`);
            updateJob(job.id, { status: "completed", progress: 100, result });

            // Record success
            await recordConversion({
                jobId: job.id,
                userId,
                feature: "dub_file",
                voice: options.voice,
                text: result.myanmarText,
                durationMs: result.durationMs,
                status: "success"
            });

            // Clean up temp upload file only after full success (retries need it)
            await fs.unlink(tempFilePath).catch(() => {});
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await safeRefund(job.id, userId, 10, "video_dub_refund", "Refund: Dub job failed");
            
            await recordConversion({
                jobId: job.id,
                userId,
                feature: "dub_file",
                status: "fail",
                errorMsg: err.message
            });
            throw err;
        }
    });

    // 2. Dub Link Processor
    registerProcessor("dub_link", async (job) => {
        const { url, userId, ...options } = job.input;
        try {
            const result = await dubVideoPipeline.executeFromLink(url, options, job.id);

            // Upload to R2 and sign the download URL before completing
            if (result.filename) {
                const localPath = path.join(process.cwd(), "static", "downloads", result.filename);
                result.videoUrl = await generateSignedDownloadUrl(result.filename);

                if (r2Service.isEnabled() && userId) {
                    try {
                        const videoKey = r2Key("video", result.filename, userId);
                        await r2Service.uploadFromPath(videoKey, localPath, "video/mp4");
                        result.videoUrl = await generateSignedDownloadUrl(result.filename, userId, "video");
                        await fs.unlink(localPath).catch(() => {});
                    } catch (r2Err) {
                        console.error(`[Job ${job.id}] R2 video upload failed, keeping local file:`, r2Err);
                    }

                    // Upload SRT if generated
                    if (result.srtContent && result.shortId) {
                        const srtFilename = buildOutputFilename(result.shortId, "SRT", "srt");
                        try {
                            const srtKey = r2Key("subtitle", srtFilename, userId);
                            await r2Service.uploadFile(srtKey, Buffer.from(result.srtContent, "utf-8"), "text/plain; charset=utf-8");
                            (result as any).srtUrl = await generateSignedDownloadUrl(srtFilename, userId, "subtitle");
                        } catch (r2Err) {
                            console.error(`[Job ${job.id}] R2 subtitle upload failed:`, r2Err);
                        }
                    }
                }
            }

            console.log(`[Job ${job.id}] Dub link successful: ${result.videoUrl}`);
            updateJob(job.id, { status: "completed", progress: 100, result });

            // Record success
            await recordConversion({
                jobId: job.id,
                userId,
                feature: "dub_link",
                voice: options.voice,
                text: result.myanmarText,
                durationMs: result.durationMs,
                status: "success"
            });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await safeRefund(job.id, userId, 10, "video_dub_refund", "Refund: Dub link job failed");
            
            await recordConversion({
                jobId: job.id,
                userId,
                feature: "dub_link",
                status: "fail",
                errorMsg: err.message
            });
            throw err;
        }
    });

    // 3. Translate File Processor
    registerProcessor("translate_file", async (job) => {
        const { tempFilePath, filename, userId, userApiKey } = job.input;
        try {
            const buffer = await fs.readFile(tempFilePath);
            const result = await translateVideoPipeline.execute(buffer, filename, userApiKey, job.id);
            updateJob(job.id, { status: "completed", progress: 100, result });

            await recordConversion({
                jobId: job.id,
                userId,
                feature: "video_upload",
                text: result.myanmarText,
                status: "success"
            });

            // Clean up temp upload file only after full success (retries need it)
            await fs.unlink(tempFilePath).catch(() => {});
        } catch (err: any) {
            if (userId) await safeRefund(job.id, userId, 5, "video_translate_refund", "Refund: Translate job failed");
            await recordConversion({
                jobId: job.id,
                userId,
                feature: "video_upload",
                status: "fail",
                errorMsg: err.message
            });
            throw err;
        }
    });

    // 4. Translate Link Processor
    registerProcessor("translate_link", async (job) => {
        const { url, userId, userApiKey } = job.input;
        try {
            const result = await translateVideoPipeline.executeFromLink(url, userApiKey, job.id);
            updateJob(job.id, { status: "completed", progress: 100, result });

            await recordConversion({
                jobId: job.id,
                userId,
                feature: "video_link",
                text: result.myanmarText,
                status: "success"
            });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await safeRefund(job.id, userId, 5, "video_translate_refund", "Refund: Translate link job failed");
            await recordConversion({
                jobId: job.id,
                userId,
                feature: "video_link",
                status: "fail",
                errorMsg: err.message
            });
            throw err;
        }
    });
}

// Cleanup: 24h ကျော်တာတွေပဲ ဖြုတ် (retry window ထဲ protection မပျောက်)
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
}, 60 * 60 * 1000); // every 1 hour
