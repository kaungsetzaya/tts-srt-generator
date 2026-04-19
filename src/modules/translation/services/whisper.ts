import { existsSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { Segment } from "../../../shared/types/segment";
import type { WhisperResult } from "../types";

const execFileAsync = promisify(execFile);

// Detect python command
function getPythonCmd(): string {
  if (process.platform === "win32") return "python";
  if (existsSync("/usr/bin/python3")) return "python3";
  if (existsSync("/usr/bin/python")) return "python";
  return "python3"; // fallback
}

// ═══════════════════════════════════════════════════════════════
// Whisper Transcription Service
// ═══════════════════════════════════════════════════════════════

export class WhisperService {
  /** Transcribe audio buffer to text with segments */
  async transcribe(audioBuffer: Buffer): Promise<WhisperResult> {
    const id = randomUUID();
    const tempDir = tmpdir();
    const audioPath = path.join(tempDir, `whisper_${id}.mp3`);
    const outputPath = path.join(tempDir(), `whisper_${id}.json`);

    try {
      await fs.writeFile(audioPath, audioBuffer);

      const pythonCmd = getPythonCmd();
      const scriptPath = path.join(process.cwd(), "python", "transcriber.py");
      await execFileAsync(pythonCmd, [
        scriptPath,
        audioPath,
        outputPath,
      ]);

      const content = await fs.readFile(outputPath, "utf-8");
      const data = JSON.parse(content);

      return {
        text: data.text,
        segments: data.segments.map((s: { start: number; end: number; text: string }) => ({
          id: randomUUID(),
          text: s.text,
          start: s.start,
          end: s.end,
        })),
      };
    } finally {
      await fs.unlink(audioPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }
}

export const whisper = new WhisperService();