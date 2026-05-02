/**
 * Video Translate Processor — Handles translate_file and translate_link background jobs
 * Separated from shared processors.ts per architecture requirements
 */
import { promises as fs } from "fs";
import { registerProcessor, updateJob } from "../../../../jobs";
import { translateVideoPipeline } from "../../translation/pipelines/translateVideo.pipeline";
import { recordConversion } from "../stats";
import { safeRefund } from "./shared";

export function registerVideoTranslateProcessors() {
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
