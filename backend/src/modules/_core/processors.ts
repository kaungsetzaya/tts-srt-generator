import { registerProcessor, updateJob } from "../../../jobs";
import { dubVideoPipeline } from "../dubbing/pipelines/dubVideo.pipeline";
import { translateVideoPipeline } from "../translation/pipelines/translateVideo.pipeline";
import { addCredits } from "../../../routers/credits";
import { generateSignedDownloadUrl } from "./signedUrl";

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
            
            // Sign the download URL before completing
            if (result.filename) {
                result.videoUrl = generateSignedDownloadUrl(result.filename);
            }

            console.log(`[Job ${job.id}] Dub file successful: ${result.videoUrl}`);
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

            // Sign the download URL before completing
            if (result.filename) {
                result.videoUrl = generateSignedDownloadUrl(result.filename);
            }

            console.log(`[Job ${job.id}] Dub link successful: ${result.videoUrl}`);
            updateJob(job.id, { status: "completed", progress: 100, result });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
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
        const { url, userId, userApiKey } = job.input;
        try {
            const result = await translateVideoPipeline.executeFromLink(url, userApiKey);
            updateJob(job.id, { status: "completed", progress: 100, result });
        } catch (err: any) {
            console.error(`[Job ${job.id}] Failed:`, err);
            if (userId) await addCredits(userId, 5, "video_translate_refund", "Refund: Translate link job failed");
            throw err;
        }
    });
}
