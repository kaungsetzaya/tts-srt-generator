import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
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
  console.log(`[Dubber] Running Whisper on ${audioPath}`);
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
    console.log(`[Dubber 5%] Video saved: ${Math.round(videoBuffer.length / 1024)}KB`);

    const tempAudioExtract = path.join(tempDir, `ext_${id}.mp3`);
    console.log(`[Dubber 10%] Extracting audio...`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath).noVideo().audioCodec('libmp3lame').on('end', () => resolve()).on('error', reject).save(tempAudioExtract);
    });

    console.log(`[Dubber 20%] Transcribing...`);
    const whisperResult = await transcribeLocalWhisper(tempAudioExtract);
    console.log(`[Dubber 30%] Transcribed ${whisperResult.segments.length} segments`);

    console.log(`[Dubber 35%] Translating...`);
    const { translated: translatedSegments } = await geminiTranslateForDub(whisperResult.segments, options.userApiKey);
    console.log(`[Dubber 50%] Translation complete`);
    
    const concatLines: string[] = [];
    let currentAudioMs = 0;
    console.log(`[Dubber 55%] Starting TTS Loop for ${translatedSegments.length} segments`);

    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      if (!seg.text.trim()) continue;
      
      console.log(`[Dubber 57%] Processing segment ${i + 1}/${translatedSegments.length}: "${seg.text.substring(0, 20)}..."`);
      
      try {
        const tts = await generateSpeech(seg.text, options.voice, options.speed, options.pitch);
        const segPath = path.join(tempDir, `s_${i}.mp3`);
        await fs.writeFile(segPath, tts.audioBuffer);
        concatLines.push(`file '${segPath}'`);
        currentAudioMs += tts.durationMs;
      } catch (ttsErr) {
        console.error(`[Dubber Error] TTS failed for segment ${i}:`, ttsErr);
        // Continue to next segment instead of crashing
      }
    }

    console.log(`[Dubber 72%] Merging ${concatLines.length} TTS segments...`);
    const listPath = path.join(tempDir, 'list.txt');
    await fs.writeFile(listPath, concatLines.join('\n'));
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg().input(listPath).inputOptions(['-f', 'concat', '-safe', '0']).on('end', () => resolve()).on('error', reject).save(tempTTSAudio);
    });

    const videoDuration = await getVideoDuration(tempVideoPath);
    const speedRatio = videoDuration / (currentAudioMs / 1000);
    console.log(`[Dubber 80%] Video: ${videoDuration}s, Audio: ${currentAudioMs/1000}s, Ratio: ${speedRatio.toFixed(2)}`);

    console.log(`[Dubber 85%] Final FFmpeg Combine...`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .input(tempTTSAudio)
        .outputOptions([
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '32',
          '-c:a', 'aac', '-map', '0:v', '-map', '1:a', '-shortest'
        ])
        .on('progress', (p) => console.log(`[Dubber Progress] ${Math.round(p.percent)}%`))
        .on('error', (e) => { console.error("[FFmpeg Final Error]", e); reject(e); })
        .on('end', () => resolve())
        .save(tempOutputPath);
    });

    const downloadFilename = `dub_${id}.mp4`;
    const finalPath = path.join(process.cwd(), 'static', 'downloads', downloadFilename);
    await fs.mkdir(path.dirname(finalPath), { recursive: true }).catch(() => {});
    await fs.copyFile(tempOutputPath, finalPath);
    
    const videoUrl = `https://choco.de5.net/downloads/${downloadFilename}`;
    console.log(`[Dubber 100%] ✅ Success: ${videoUrl}` );
    return { videoUrl, myanmarText: "", srtContent: "", durationMs: currentAudioMs };
  } catch (err: any) {
    console.error("[Dubber Critical Error]", err);
    throw err;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function dubVideoFromLink(url: string, options: DubOptions): Promise<DubResult> {
  const id = randomUUID();
  const tempVideoPath = path.join(tmpdir(), `dl_${id}.mp4`);
  console.log(`[Dubber] Downloading ${url}`);
  await downloadVideo(url, tempVideoPath, { timeout: 300000 });
  const buffer = await fs.readFile(tempVideoPath);
  const result = await dubVideoFromBuffer(buffer, "v.mp4", options);
  await fs.unlink(tempVideoPath).catch(() => {});
  return result;
}
