import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { promises as fs } from 'fs';

const execFileAsync = promisify(execFile);

export interface WhisperSegment {
    start: number;
    end: number;
    text: string;
}

export class WhisperService {
    /**
     * Pre-flight check to ensure python and required tools are available.
     */
    async checkEnvironment(): Promise<void> {
        try {
            const bin = await this.getPythonBin();
            await execFileAsync(bin, ["-c", "import faster_whisper"], { timeout: 10000 });
        } catch (err: any) {
            throw new Error(`Whisper environment not ready: ${err.message}. Ensure faster-whisper is installed in python.`);
        }
    }

    private async getPythonBin(): Promise<string> {
        for (const bin of ["python3", "python"]) {
            try {
                await execFileAsync(bin, ["--version"], { timeout: 5000 });
                return bin;
            } catch {}
        }
        throw new Error("Python not found (python3 or python).");
    }

    /**
     * Transcribes an audio file using faster-whisper via local python script.
     */
    async transcribe(audioPath: string): Promise<WhisperSegment[]> {
        // Check if audio file exists and has content
        try {
            const stats = await fs.stat(audioPath);
            if (stats.size === 0) {
                throw new Error("Audio file is empty - video may have no audio track");
            }
        } catch (err: any) {
            if (err.code === "ENOENT") {
                throw new Error("Audio file not found - extraction may have failed");
            }
            throw err;
        }

        const bin = await this.getPythonBin();
        const outputDir = path.dirname(audioPath);
        const baseName = path.parse(audioPath).name;
        const scriptPath = path.join(process.cwd(), "python", "transcriber.py");
        const outputJson = path.join(outputDir, `${baseName}_transcription.json`);

        try {
            await execFileAsync(bin, [scriptPath, audioPath, outputJson], {
                timeout: 300000,
                killSignal: "SIGKILL",
                maxBuffer: 10 * 1024 * 1024,
            });
        } catch (err: any) {
            // Clean up failed output
            await fs.unlink(outputJson).catch(() => {});
            
            // Check for common issues
            if (err.message?.includes("Invalid data") || err.message?.includes("invalid data")) {
                throw new Error("Could not decode audio - video may have no audio or unsupported format");
            }
            throw new Error(`Transcription failed: ${err.message}`);
        }

        const data = JSON.parse(await fs.readFile(outputJson, "utf-8"));
        await fs.unlink(outputJson).catch(() => {});

        if (!data.segments || data.segments.length === 0) {
            throw new Error("No speech detected in video audio");
        }

        return (data.segments || []).map((seg: any) => ({
            start: seg.start,
            end: seg.end,
            text: (seg.text || "").trim(),
        })).filter((seg: WhisperSegment) => seg.text.length > 0);
    }
}

export const whisperService = new WhisperService();
