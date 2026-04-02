import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

/**
 * Extract audio from video file using FFmpeg
 */
export async function extractAudioFromVideo(videoPath: string): Promise<Buffer> {
  const audioPath = path.join("/tmp", `audio-${Date.now()}.wav`);

  try {
    // Extract audio using FFmpeg
    execSync(`ffmpeg -i "${videoPath}" -q:a 9 -n "${audioPath}" 2>/dev/null`, {
      stdio: "pipe",
    });

    // Read the audio file
    const audioBuffer = fs.readFileSync(audioPath);

    // Clean up
    fs.unlinkSync(audioPath);

    return audioBuffer;
  } catch (error) {
    // Clean up on error
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
    // Convert audio buffer to base64
    const audioBase64 = audioBuffer.toString("base64");

    // Call VPS API for transcription and translation
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
    // Extract audio from video
    const audioBuffer = await extractAudioFromVideo(videoPath);

    // Transcribe and translate using VPS
    const result = await transcribeAndTranslateVPS(audioBuffer, vpsApiUrl);

    return result;
  } catch (error) {
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
