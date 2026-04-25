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
            // Clean up temp upload file after reading
            await fs.unlink(tempFilePath).catch(() => {});
            
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
                userId,
                feature: "dub_file",
                voice: options.voice,
                text: result.myanmarText,
                durationMs: result.durationMs,
                status: "success"
            });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await addCredits(userId, 10, "video_dub_refund", "Refund: Dub job failed");
            
            await recordConversion({
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
                userId,
                feature: "dub_link",
                voice: options.voice,
                text: result.myanmarText,
                durationMs: result.durationMs,
                status: "success"
            });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await addCredits(userId, 10, "video_dub_refund", "Refund: Dub link job failed");
            
            await recordConversion({
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
            // Clean up temp upload file after reading
            await fs.unlink(tempFilePath).catch(() => {});
            updateJob(job.id, { status: "completed", progress: 100, result });

            await recordConversion({
                userId,
                feature: "video_upload",
                text: result.myanmarText,
                status: "success"
            });
        } catch (err: any) {
            if (userId) await addCredits(userId, 5, "video_translate_refund", "Refund: Translate job failed");
            await recordConversion({
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
                userId,
                feature: "video_link",
                text: result.myanmarText,
                status: "success"
            });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await addCredits(userId, 5, "video_translate_refund", "Refund: Translate link job failed");
            await recordConversion({
                userId,
                feature: "video_link",
                status: "fail",
                errorMsg: err.message
            });
            throw err;
        }
    });
}
