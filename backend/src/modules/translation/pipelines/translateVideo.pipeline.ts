import { randomUUID } from "crypto";
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Services
import { ffmpegService } from '../../media/services/ffmpeg.service';
import { whisperService } from '../services/whisper.service';
import { geminiService } from '../services/gemini.service';

export class TranslateVideoPipeline {
    /**
     * Step-by-step video translation pipeline.
     */
    async execute(videoBuffer: Buffer, filename: string, userApiKey?: string) {
        const id = randomUUID();
        const tempVideoPath = path.join(tmpdir(), `vt_pipe_${id}.mp4`);
        const tempAudioPath = path.join(tmpdir(), `vt_pipe_${id}.mp3`);

        try {
            // Step 1: Write video and check duration
            await fs.writeFile(tempVideoPath, videoBuffer);
            const duration = await ffmpegService.getVideoDuration(tempVideoPath);
            if (duration > 150) throw new Error("Video too long. Max 2min 30sec.");

            // Step 2: Extract audio
            await ffmpegService.extractAudio(tempVideoPath, tempAudioPath);

            // Step 3: Transcription
            const { text: englishText } = await whisperService.transcribe(tempAudioPath).then(segs => ({
                text: segs.map(s => s.text).join(" ")
            }));

            if (!englishText.trim()) throw new Error("No speech detected.");

            // Step 4: Translation
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
