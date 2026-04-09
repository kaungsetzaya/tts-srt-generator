import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import axios from "axios";
import { isPathWithinDir } from "./_core/security";

const execFileAsync = promisify(execFile);

/**
 * Extract audio from video file using FFmpeg
 * 🔐 Uses execFile with argument array to prevent command injection
 */
export async function extractAudioFromVideo(videoPath: string): Promise<Buffer> {
  // 🔐 UUID filename
  const id = randomUUID();
  const audioPath = path.join(tmpdir(), `vp_audio_${id}.wav`);
  
  // 🔐 Path traversal check
  if (!isPathWithinDir(audioPath, tmpdir())) {
    throw new Error("Invalid temp directory.");
  }

  try {
    // 🔐 FFmpeg Command Guard: execFile with argument array
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-q:a", "9",
      "-n", audioPath
    ], { timeout: 120000 });

    const audioBuffer = fs.readFileSync(audioPath);
    fs.unlinkSync(audioPath);
    return audioBuffer;
  } catch (error) {
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    throw new Error(`Failed to extract audio from video: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Call VPS API to transcribe and translate audio
 */
export async function transcribeAndTranslateVPS(
  audioBuffer: Buffer,
  vpsApiUrl: string
): Promise<{ originalText: string; translatedText: string }> {
  try {
    const audioBase64 = audioBuffer.toString("base64");

    const response = await axios.post(
      `${vpsApiUrl}/transcribe-translate`,
      {
        audio: audioBase64,
        targetLanguage: "my", // Myanmar language code
      },
      {
        timeout: 120000, // 2 minutes timeout for processing
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.originalText && response.data.translatedText) {
      return {
        originalText: response.data.originalText,
        translatedText: response.data.translatedText,
      };
    } else {
      throw new Error("Invalid response from VPS API");
    }
  } catch (error) {
    throw new Error(
      `Failed to transcribe and translate: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Process video file: extract audio, transcribe, and translate
 */
export async function processVideoFile(
  videoPath: string,
  vpsApiUrl: string
): Promise<{ originalText: string; translatedText: string }> {
  try {
    const audioBuffer = await extractAudioFromVideo(videoPath);
    const result = await transcribeAndTranslateVPS(audioBuffer, vpsApiUrl);
    return result;
  } catch (error) {
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
