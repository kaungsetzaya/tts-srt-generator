import { registerProcessor, updateJob } from "../../../jobs";
import { dubVideoPipeline } from "../dubbing/pipelines/dubVideo.pipeline";
import { translateVideoPipeline } from "../translation/pipelines/translateVideo.pipeline";
import { addCredits } from "../../../routers/credits";

/**
 * Centrally registers all background job processors.
 * Wiring up jobs to the new modular Pipelines.
 */

export function registerAllProcessors() {
    // 1. Dub File Processor
    registerProcessor("dub_file", async (job) => {
        const { videoBase64, filename, userId, ...options } = job.input;
        try {
            const buffer = Buffer.from(videoBase64, 'base64');
            const result = await dubVideoPipeline.execute(buffer, filename, options);
            updateJob(job.id, { status: "completed", progress: 100, result });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await addCredits(userId, 10, "video_dub_refund", "Refund: Dub job failed");
            throw err;
        }
    });

    // 2. Dub Link Processor
    registerProcessor("dub_link", async (job) => {
        const { url, userId, ...options } = job.input;
        try {
            const result = await dubVideoPipeline.executeFromLink(url, options);
            updateJob(job.id, { status: "completed", progress: 100, result });
        } catch (err: any) {
            if (userId) await addCredits(userId, 10, "video_dub_refund", "Refund: Dub link job failed");
            throw err;
        }
    });

    // 3. Translate File Processor
    registerProcessor("translate_file", async (job) => {
        const { videoBase64, filename, userId, userApiKey } = job.input;
        try {
            const buffer = Buffer.from(videoBase64, 'base64');
            const result = await translateVideoPipeline.execute(buffer, filename, userApiKey);
            updateJob(job.id, { status: "completed", progress: 100, result });
        } catch (err: any) {
            if (userId) await addCredits(userId, 5, "video_translate_refund", "Refund: Translate job failed");
            throw err;
        }
    });

    // 4. Translate Link Processor
    registerProcessor("translate_link", async (job) => {
        // ... implementation using translateVideoPipeline.executeFromLink (to be added)
        updateJob(job.id, { status: "failed", error: "Translate from link not yet modularized" });
    });
}
