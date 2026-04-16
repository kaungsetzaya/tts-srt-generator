import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID, randomBytes } from 'crypto';
// @ts-ignore - fluent-ffmpeg doesn't have types
import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { geminiTranslate } from "./geminiTranslator";
import { geminiTranslateForDub } from "./geminiDubTranslator";
import { downloadVideo } from "./_core/multiDownloader";
import { generateSpeech, generateSpeechWithCharacter, type VoiceKey, type CharacterKey, CHARACTER_VOICES } from "./tts";
import { isAllowedVideoUrl, isPathWithinDir, sanitizeForAI } from "./_core/security";
import type { DubOptions, DubResult } from "@shared/types";

const execFileAsync = promisify(execFile);
export type { DubOptions, DubResult } from "@shared/types";

function generateId(length: number = 10): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string; srt: string; segments: any[] }> {
  const outputDir = path.dirname(audioPath);
  const baseName = path.parse(audioPath).name;
  const scriptPath = path.join(process.cwd(), "backend", "transcriber.py");
  const outputJson = path.join(outputDir, `${baseName}_transcription.json`);
  await execFileAsync("python3", [scriptPath, audioPath, outputJson]);
  const data = JSON.parse(await fs.readFile(outputJson, 'utf-8'));
  const segments = data.segments?.map((seg: any) => ({ start: seg.start, end: seg.end, text: seg.text?.trim() || "" })) || [];
  await fs.unlink(outputJson).catch(() => {});
  return { text: data.text || "", srt: "", segments };
}

export async function dubVideoFromBuffer(videoBuffer: Buffer, filename: string, options: DubOptions): Promise<DubResult> {
  const id = randomUUID();
  const tempDir = path.join(tmpdir(), `dub_${id}`);
  await fs.mkdir(tempDir, { recursive: true });
  const tempVideoPath = path.join(tempDir, `input_${id}.mp4`);
  const tempTTSAudio = path.join(tempDir, `tts_${id}.mp3`);
  const tempOutputPath = path.join(tempDir, `output_${id}.mp4`);

  try {
    await fs.writeFile(tempVideoPath, videoBuffer);
    const tempAudioExtract = path.join(tempDir, `ext_${id}.mp3`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath).noVideo().audioCodec('libmp3lame').on('end', () => resolve()).on('error', reject).save(tempAudioExtract);
    });

    const whisperResult = await transcribeLocalWhisper(tempAudioExtract);
    const { translated: translatedSegments } = await geminiTranslateForDub(whisperResult.segments, options.userApiKey);
    
    const concatLines: string[] = [];
    let totalDurationMs = 0;
    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      if (!seg.text.trim()) continue;
      try {
        const tts = await generateSpeech(seg.text, options.voice, options.speed, options.pitch);
        const segPath = path.join(tempDir, `s_${i}.mp3`);
        await fs.writeFile(segPath, tts.audioBuffer);
        concatLines.push(`file '${segPath}'`);
        totalDurationMs += (tts.durationMs ?? 0);
      } catch (ttsErr) {
        console.error(`[Dubber Error] TTS failed for segment ${i}:`, ttsErr);
      }
    }

    const listPath = path.join(tempDir, 'list.txt');
    await fs.writeFile(listPath, concatLines.join('\n'));
    await new Promise<void>((resolve, reject) => {
      ffmpeg().input(listPath).inputOptions(['-f', 'concat', '-safe', '0']).on('end', () => resolve()).on('error', reject).save(tempTTSAudio);
    });

    const videoDuration = await getVideoDuration(tempVideoPath);
    const speedRatio = (videoDuration ?? 0) / (totalDurationMs / 1000 || 1);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .input(tempTTSAudio)
        .outputOptions([
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '32',
          '-c:a', 'aac', '-map', '0:v', '-map', '1:a', '-shortest'
        ])
        .on('progress', (p) => console.log(`[Dubber Progress] ${Math.round(p.percent ?? 0)}%`))
        .on('error', (e) => { console.error("[FFmpeg Final Error]", e); reject(e); })
        .on('end', () => resolve())
        .save(tempOutputPath);
    });

    const downloadFilename = `dub_${id}.mp4`;
    const finalPath = path.join(process.cwd(), 'static', 'downloads', downloadFilename);
    await fs.mkdir(path.dirname(finalPath), { recursive: true }).catch(() => {});
    await fs.copyFile(tempOutputPath, finalPath);
    
    const videoUrl = `https://choco.de5.net/downloads/${downloadFilename}`;
    return { videoUrl, myanmarText: "", srtContent: "", durationMs: totalDurationMs };
  } catch (err: any ) {
    console.error("[Dubber Critical Error]", err);
    throw err;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function dubVideoFromLink(url: string, options: DubOptions): Promise<DubResult> {
  const id = randomUUID();
  const tempVideoPath = path.join(tmpdir(), `dl_${id}.mp4`);
  await downloadVideo(url, tempVideoPath, { timeout: 300000 });
  const buffer = await fs.readFile(tempVideoPath);
  const result = await dubVideoFromBuffer(buffer, "v.mp4", options);
  await fs.unlink(tempVideoPath).catch(() => {});
  return result;
}
