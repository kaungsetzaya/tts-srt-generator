import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import * as ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { execFile } from "child_process";

import type { DubbingInput, DubbingOutput, DubbingOptions } from "../types";
import { whisper } from "../translation/services/whisper";
import { translateWithGemini } from "../translation/services/gemini";
import { edgeTts } from "../tts/services/edgeTts";
import { buildAssSubtitle } from "./services/assBuilder";

const execAsync = promisify(execFile);

export class DubbingPipeline {
  async process(input: DubbingInput): Promise<DubbingOutput> {
    const { videoBuffer, filename, options, userApiKey } = input;
    const id = randomUUID();
    const tempDir = path.join(tmpdir(), `dub_${id}`);

    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Step 1: Extract audio from video
      const inputPath = path.join(tempDir, "input.mp4");
      const audioPath = path.join(tempDir, "audio.mp3");

      await fs.writeFile(inputPath, videoBuffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat("mp3")
          .audioCodec("libmp3lame")
          .on("end", () => resolve())
          .on("error", reject)
          .save(audioPath);
      });

      // Step 2: Transcribe with Whisper (gets timestamps)
      const whisperResult = await whisper.transcribe(audioPath);

      if (!whisperResult.segments.length) {
        throw new Error("No speech detected in video");
      }

      // Step 3: Translate segments with Gemini (batched)
      const translatedSegments = await translateWithGemini(
        whisperResult.segments,
        userApiKey
      );

      // Step 4: Generate TTS per segment
      const ttsFiles: string[] = [];
      for (let i = 0; i < translatedSegments.length; i++) {
        const seg = translatedSegments[i];
        const ttsResult = await edgeTts.generate({
          text: seg.translatedText,
          options: { voice: options.voice, speed: 1.2, pitch: 0 },
        });

        // Save TTS audio
        const ttsPath = path.join(tempDir, `tts_${i}.mp3`);
        await fs.writeFile(ttsPath, ttsResult.audio.audioBuffer);
        ttsFiles.push(ttsPath);
      }

      // Step 5: Generate ASS subtitles if enabled
      let assContent: string | undefined;
      if (options.srtEnabled) {
        assContent = buildAssSubtitle(translatedSegments);
      }

      // Step 6: Merge audio + video
      const finalVideo = await this.mergeVideoAudio(
        videoBuffer,
        ttsFiles,
        assContent,
        tempDir
      );

      return {
        videoBuffer: finalVideo,
        srtContent: assContent,
      };
    } finally {
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async mergeVideoAudio(
    videoBuffer: Buffer,
    audioPaths: string[],
    assPath: string | undefined,
    outputDir: string
  ): Promise<Buffer> {
    const inputPath = path.join(outputDir, "input.mp4");
    const outputPath = path.join(outputDir, "output.mp4");

    await fs.writeFile(inputPath, videoBuffer);

    // If we have ASS, save it
    let assFilePath: string | undefined;
    if (assPath) {
      assFilePath = path.join(outputDir, "subtitles.ass");
      await fs.writeFile(assFilePath, assPath);
    }

    return new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath).audioCodec("aac").audioFrequency(48000);

      if (assFilePath) {
        cmd = cmd.input(assFilePath).complexFilter([
          "[0:a][1:a]amix=inputs=2:duration=first[aout]",
          "[0:v][aout]concat=n=1:v=1:a=1[out]",
        ]);
      } else if (audioPaths.length > 0) {
        // Simple: replace audio
        cmd = cmd.input(audioPaths[0]);
      }

      cmd.on("end", async () => {
        const result = await fs.readFile(outputPath);
        resolve(result);
      })
        .on("error", reject)
        .output(outputPath);
    });
  }
}

export const dubbingPipeline = new DubbingPipeline();