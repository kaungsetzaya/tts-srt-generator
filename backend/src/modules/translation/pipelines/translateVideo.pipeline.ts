import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { updateJob } from '../../../../jobs';

// Services
import { ffmpegService } from '../../media/services/ffmpeg.service';
import { getVideoInfo, downloadVideo } from '../../media/services/downloader.service';
import { whisperService } from '../services/whisper.service';
import { geminiService } from '../services/gemini.service';
import { isAllowedVideoUrl } from '../../../../_core/security';

export class TranslateVideoPipeline {
    /**
     * Orchestrates translation from a remote URL.
     */
    async executeFromLink(url: string, userApiKey?: string, jobId?: string) {
        if (!isAllowedVideoUrl(url)) throw new Error("Disallowed URL");

        const info = await getVideoInfo(url);
        if (!info) throw new Error("Could not get video info");
        if (info.duration > 150) throw new Error("Video too long (max 150s)");

        const id = randomUUID();
        const tempVideoPath = path.join(tmpdir(), `tl_${id}.mp4`);
        try {
            await downloadVideo(url, tempVideoPath);
            const buffer = await fs.readFile(tempVideoPath);
            return await this.execute(buffer, "video.mp4", userApiKey);
        } finally {
            await fs.unlink(tempVideoPath).catch(() => {});
        }
    }

    /**
     * Step-by-step video translation pipeline.
     */
    async execute(videoBuffer: Buffer, filename: string, userApiKey?: string, jobId?: string) {
        const id = randomUUID();
        const tempVideoPath = path.join(tmpdir(), `vt_pipe_${id}.mp4`);
        const tempAudioPath = path.join(tmpdir(), `vt_pipe_${id}.mp3`);

        try {
            // Step 1: Write video and check duration
            if (jobId) updateJob(jobId, { progress: 10, message: "Initializing video..." });
            await fs.writeFile(tempVideoPath, videoBuffer);
            const duration = await ffmpegService.getVideoDuration(tempVideoPath);
            if (duration > 150) throw new Error("Video too long. Max 2min 30sec.");

            // Step 2: Extract audio
            if (jobId) updateJob(jobId, { progress: 30, message: "Extracting voice..." });
            await ffmpegService.extractAudio(tempVideoPath, tempAudioPath);

            // Step 3: Transcription
            if (jobId) updateJob(jobId, { progress: 60, message: "Transcribing speech..." });
            const { text: englishText } = await whisperService.transcribe(tempAudioPath).then(segs => ({
                text: segs.map(s => s.text).join(" ။ ")
            }));

            if (!englishText.trim()) throw new Error("No speech detected.");

            // Step 4: Translation
            if (jobId) updateJob(jobId, { progress: 85, message: "Translating to Myanmar..." });
            const myanmarText = await geminiService.translateFullText(englishText, userApiKey);

            return {
                englishText,
                myanmarText,
                id
            };

        } finally {
            await fs.unlink(tempVideoPath).catch(() => {});
            await fs.unlink(tempAudioPath).catch(() => {});
        }
    }
}

export const translateVideoPipeline = new TranslateVideoPipeline();
