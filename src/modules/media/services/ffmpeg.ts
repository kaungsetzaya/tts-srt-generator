import * as ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execAsync = promisify(execFile);

// ═══════════════════════════════════════════════════════════════
// Media Processing Service (FFmpeg wrapper)
// ═══════════════════════════════════════════════════════════════

export class MediaService {
  /**
   * Extract audio from video buffer
   */
  async extractAudio(videoBuffer: Buffer, outputFormat: "mp3" | "wav" = "mp3"): Promise<Buffer> {
    const id = randomUUID();
    const inputPath = path.join(tmpdir(), `media_in_${id}.mp4`);
    const outputPath = path.join(tmpdir(), `media_out_${id}.${outputFormat}`);

    try {
      await fs.writeFile(inputPath, videoBuffer);

      const codec = outputFormat === "mp3" ? "libmp3lame" : "pcm_s16le";

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat(outputFormat)
          .audioCodec(codec)
          .on("end", resolve)
          .on("error", reject)
          .save(outputPath);
      });

      return await fs.readFile(outputPath);
    } finally {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }

  /**
   * Get video duration in seconds
   */
  async getDuration(videoBuffer: Buffer): Promise<number> {
    const id = randomUUID();
    const inputPath = path.join(tmpdir(), `media_dur_${id}.mp4`);

    try {
      await fs.writeFile(inputPath, videoBuffer);

      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata.format.duration || 0);
        });
      });
    } finally {
      await fs.unlink(inputPath).catch(() => {});
    }
  }

  /**
   * Merge video with audio and optional subtitles
   */
  async merge(
    videoBuffer: Buffer,
    audioBuffer: Buffer,
    subtitlePath?: string
  ): Promise<Buffer> {
    const id = randomUUID();
    const videoPath = path.join(tmpdir(), `merge_v_${id}.mp4`);
    const audioPath = path.join(tmpdir(), `merge_a_${id}.mp3`);
    const subPath = path.join(tmpdir(), `merge_s_${id}.ass`);
    const outputPath = path.join(tmpdir(), `merge_o_${id}.mp4`);

    try {
      await fs.writeFile(videoPath, videoBuffer);
      await fs.writeFile(audioPath, audioBuffer);

      let command = ffmpeg(videoPath)
        .input(audioPath)
        .outputOptions([
          "-map", "0:v",
          "-map", "1:a",
          "-c:v", "copy",
          "-c:a", "aac",
          "-shortest",
        ]);

      if (subtitlePath) {
        await fs.writeFile(subPath, subtitlePath);
        command = command
          .input(subPath)
          .outputOptions([
            "-map", "0:v",
            "-map", "1:a",
            "-map", "2:s",
            "-c:v", "copy",
            "-c:a", "aac",
            "-c:s", "mov_text",
            "-shortest",
          ]);
      }

      return new Promise((resolve, reject) => {
        command
          .on("end", async () => {
            const result = await fs.readFile(outputPath);
            resolve(result);
          })
          .on("error", reject)
          .save(outputPath);
      });
    } finally {
      await fs.unlink(videoPath).catch(() => {});
      await fs.unlink(audioPath).catch(() => {});
      if (subtitlePath) await fs.unlink(subPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }

  /**
   * Concatenate multiple audio files
   */
  async concatAudio(audioBuffers: Buffer[], outputFormat: "mp3" = "mp3"): Promise<Buffer> {
    const id = randomUUID();
    const listPath = path.join(tmpdir(), `concat_${id}.txt`);
    const outputPath = path.join(tmpdir(), `concat_o_${id}.${outputFormat}`);

    const tempFiles: string[] = [];

    try {
      // Write each buffer to temp file
      for (let i = 0; i < audioBuffers.length; i++) {
        const tempPath = path.join(tmpdir(), `concat_${id}_${i}.${outputFormat}`);
        await fs.writeFile(tempPath, audioBuffers[i]);
        tempFiles.push(tempPath);
        await fs.writeFile(listPath, tempFiles.map(f => `file '${f}'`).join("\n"), {
          flag: "a",
        });
      }

      // Concatenate
      await execAsync("ffmpeg", [
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        outputPath,
      ]);

      return await fs.readFile(outputPath);
    } finally {
      for (const f of tempFiles) await fs.unlink(f).catch(() => {});
      await fs.unlink(listPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }
}

export const media = new MediaService();