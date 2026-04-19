import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import * as ffmpeg from "fluent-ffmpeg";

import type { DubbingInput, DubbingOutput, DubbingOptions } from "./types";
import { whisper } from "../translation/services/whisper";
import { translateWithGemini } from "../translation/services/gemini";
import { generateSpeech } from "../tts/services/edgeTts";
import { mergeVideoAudio } from "./services/merger";
import { buildAssSubtitle } from "./services/assBuilder";

export class DubbingPipeline {
  async process(input: DubbingInput): Promise<DubbingOutput> {
    const { videoBuffer, filename, options, userApiKey } = input;
    const id = randomUUID();
    const tempDir = path.join(tmpdir(), `dub_${id}`);

    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Step 1: Extract audio from video
      const audioPath = await this.extractAudio(videoBuffer, tempDir);

      // Step 2: Transcribe with Whisper
      const whisperResult = await whisper.transcribe(audioBuffer);

      if (!whisperResult.segments.length) {
        throw new Error("No speech detected in video");
      }

      // Step 3: Translate segments with Gemini (batch)
      const translatedSegments = await translateWithGemini(
        whisperResult.segments,
        userApiKey
      );

      // Step 4: Generate TTS per segment
      const ttsFiles: { path: string; duration: number }[] = [];
      for (const seg of translatedSegments) {
        const ttsResult = await generateSpeech({
          text: seg.translatedText,
          options: { voice: options.voice, speed: 1.2, pitch: 0 },
        });
        ttsFiles.push({
          path: ttsResult.audioPath,
          duration: ttsResult.duration,
        });
      }

      // Step 5: Generate ASS subtitles if enabled
      let assContent: string | undefined;
      if (options.srtEnabled) {
        assContent = buildAssSubtitle(translatedSegments);
      }

      // Step 6: Merge audio + video
      const finalVideo = await mergeVideoAudio(
        videoBuffer,
        ttsFiles.map(f => f.path),
        assContent,
        tempDir
      );

      return {
        videoBuffer: finalVideo,
        srtContent: assContent,
      };
    } finally {
      // Cleanup temp files
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async extractAudio(videoBuffer: Buffer, tempDir: string): Promise<string> {
    const inputPath = path.join(tempDir, "input.mp4");
    const audioPath = path.join(tempDir, "audio.mp3");

    await fs.writeFile(inputPath, videoBuffer);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("mp3")
        .audioCodec("libmp3lame")
        .on("end", () => resolve(audioPath))
        .on("error", reject)
        .save(audioPath);
    });
  }
}

export const dubbingPipeline = new DubbingPipeline();