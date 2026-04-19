import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { SrtCue, AudioResult } from "../../../shared/types/segment";
import type { TtsInput, TtsOutput } from "../types";

const execFileAsync = promisify(execFile);

const VOICE_MAP: Record<string, string> = {
  thiha: "my-MM-ThihaNeural",
  nilar: "my-MM-NilarNeural",
};

export class EdgeTtsService {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private readonly maxConcurrent = 3;

  private async throttle<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  async generate(input: TtsInput): Promise<TtsOutput> {
    return this.throttle(async () => {
      const voice = VOICE_MAP[input.options.voice] || VOICE_MAP.thiha;
      const rate = (input.options.speed ?? 1.0) * 125;
      const pitch = input.options.pitch ?? 0;

      const id = randomUUID();
      const tempDir = tmpdir();
      const audioPath = path.join(tempDir, `tts_${id}.mp3`);
      const srtPath = path.join(tempDir, `tts_${id}.srt`);

      try {
        await execFileAsync("python", [
          "-m",
          "edge_tts",
          "-t",
          input.text,
          "-v",
          voice,
          "-f",
          srtPath,
          "--rate=" + `+${rate}%`,
          "--pitch=" + `${pitch > 0 ? "+" : ""}${pitch}Hz`,
          "-o",
          audioPath,
        ]);

        const audioBuffer = await fs.readFile(audioPath);
        const srtContent = await fs.readFile(srtPath, "utf-8");

        const cues = this.parseSrt(srtContent);
        const durationMs = this.calculateDuration(cues);

        return {
          audio: {
            audioBuffer,
            durationMs,
          },
          srt: cues,
          rawSrt: srtContent,
        };
      } finally {
        await fs.unlink(audioPath).catch(() => {});
        await fs.unlink(srtPath).catch(() => {});
      }
    });
  }

  private parseSrt(content: string): SrtCue[] {
    const cues: SrtCue[] = [];
    const blocks = content.trim().split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split("\n");
      if (lines.length < 3) continue;

      const idx = parseInt(lines[0], 10);
      const timeMatch = lines[1].match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );
      if (!timeMatch) continue;

      const startMs =
        parseInt(timeMatch[1]) * 3600000 +
        parseInt(timeMatch[2]) * 60000 +
        parseInt(timeMatch[3]) * 1000 +
        parseInt(timeMatch[4]);

      const endMs =
        parseInt(timeMatch[5]) * 3600000 +
        parseInt(timeMatch[6]) * 60000 +
        parseInt(timeMatch[7]) * 1000 +
        parseInt(timeMatch[8]);

      cues.push({
        index: idx,
        startMs,
        endMs,
        text: lines.slice(2).join(" "),
      });
    }

    return cues;
  }

  private calculateDuration(cues: SrtCue[]): number {
    if (cues.length === 0) return 0;
    return cues[cues.length - 1].endMs;
  }
}

export const edgeTts = new EdgeTtsService();