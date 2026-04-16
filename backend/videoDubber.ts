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

// Re-export for routers.ts which imports from here
export type { DubOptions, DubResult } from "@shared/types";

// ───── Get video duration in seconds ─────
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

// ───── Get audio duration in seconds ─────
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

// ───── Stable-ts transcription with gapless segments ─────
async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string; srt: string; segments: WhisperSegment[] }> {
  const outputDir = path.dirname(audioPath);
  const baseName = path.parse(audioPath).name;
  const scriptPath = path.join(process.cwd(), "backend", "transcriber.py");
  const outputJson = path.join(outputDir, `${baseName}_transcription.json`);

  if (!isPathWithinDir(scriptPath, process.cwd()) || !isPathWithinDir(outputJson, outputDir)) {
    throw new Error("Invalid path detected.");
  }

  // Run Python faster-whisper transcription
  await execFileAsync("python3", [scriptPath, audioPath, outputJson]);

  // Read the JSON output from Python
  const data = JSON.parse(await fs.readFile(outputJson, 'utf-8'));
  
  const text = data.text || "";
  const segments: WhisperSegment[] = data.segments?.map((seg: any) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text?.trim() || ""
  })) || [];

  // Generate SRT from segments
  const srt = buildSrtFromSegments(segments);

  // Cleanup temp files
  await fs.unlink(outputJson).catch(() => {});

  return { text, srt, segments };
}

// ───── Build SRT from segments ─────
function buildSrtFromSegments(segments: WhisperSegment[]): string {
  function msToSrtTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.round(ms % 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mil).padStart(3, '0')}`;
  }

  const lines: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    lines.push(String(i + 1));
    lines.push(`${msToSrtTime(seg.start * 1000)} --> ${msToSrtTime(seg.end * 1000)}`);
    lines.push(seg.text);
    lines.push("");
  }
  return lines.join("\n");
}

interface WhisperSegment {
  index: number;
  start: number;
  end: number;
  text: string;
}

// ───── Build SRT from translated segments (gapless) ─────
function buildSrtFromTranslatedSegments(segments: WhisperSegment[], durationRatio: number = 1.0): string {
  function msToSrtTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.round(ms % 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mil).padStart(3, '0')}`;
  }

  const lines: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Scale timestamps by durationRatio to match actual TTS duration
    const scaledStart = Math.round(seg.start * 1000 * durationRatio);
    const scaledEnd = Math.round(seg.end * 1000 * durationRatio);
    lines.push(String(i + 1));
    lines.push(`${msToSrtTime(scaledStart)} --> ${msToSrtTime(scaledEnd)}`);
    lines.push(seg.text);
    lines.push("");
  }
  return lines.join("\n");
}

// ───── Build SRT from actual Whisper timestamps ─────
function buildMyanmarSRTFromSegments(segments: WhisperSegment[], myanmarSegments: string[], charsPerLine: number = 22): string {
  function msToSrtTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.round(ms % 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mil).padStart(3, '0')}`;
  }

  const result: string[] = [];
  let subtitleIndex = 1;

  for (let i = 0; i < segments.length && i < myanmarSegments.length; i++) {
    const seg = segments[i];
    const myanmarText = myanmarSegments[i]?.trim();
    
    if (!myanmarText) continue;
    
    // Split long lines
    const words = myanmarText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";
    
    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= charsPerLine) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Use original timing
    const startMs = Math.round(seg.start * 1000);
    const endMs = Math.round(seg.end * 1000);
    
    result.push(`${subtitleIndex}`);
    result.push(`${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}`);
    result.push(lines.join("\n"));
    result.push("");
    subtitleIndex++;
  }

  return result.join("\n");
}

// ───── Build SRT content from Myanmar text (legacy, estimate timing) ─────
function buildMyanmarSRT(text: string, durationMs: number, charsPerLine: number = 20): string {
  const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
  function graphemeLen(s: string): number {
    return Array.from(segmenter.segment(s)).length;
  }

  function msToSrtTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mil).padStart(3, '0')}`;
  }

  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return "";

  const segments: string[][] = [];
  let cur: string[] = [];
  for (const token of tokens) {
    cur.push(token);
    if (/[၊။]$/.test(token)) { segments.push(cur); cur = []; }
  }
  if (cur.length > 0) segments.push(cur);

  const lines: string[] = [];
  for (const seg of segments) {
    let current: string[] = [];
    let currentChars = 0;
    for (const token of seg) {
      const tokenChars = graphemeLen(token);
      if (currentChars > 0 && currentChars + 1 + tokenChars > charsPerLine) {
        lines.push(current.join(" "));
        current = []; currentChars = 0;
      }
      current.push(token);
      currentChars += (currentChars > 0 ? 1 : 0) + tokenChars;
    }
    if (current.length > 0) lines.push(current.join(" "));
  }

  const blocks: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (i + 1 < lines.length) { blocks.push([lines[i], lines[i + 1]]); i += 2; }
    else { blocks.push([lines[i]]); i++; }
  }

  const blockWordCounts = blocks.map(b => b.join(" ").split(/\s+/).filter(t => t.length > 0).length);
  const totalBlockWords = blockWordCounts.reduce((a, b) => a + b, 0);

  const result: string[] = [];
  let currentMs = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const blockDuration = Math.round((blockWordCounts[idx] / totalBlockWords) * durationMs);
    const startMs = currentMs;
    const endMs = idx === blocks.length - 1 ? durationMs : currentMs + blockDuration;
    currentMs = endMs;
    result.push(`${idx + 1}`);
    result.push(`${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}`);
    result.push(blocks[idx].join("\n"));
    result.push("");
  }

  return result.join("\n");
}

// ───── Convert hex color to ASS color format ─────
function hexToASS(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}`.toUpperCase();
}

// ───── MAIN: Dub video from buffer ─────
export async function dubVideoFromBuffer(videoBuffer: Buffer, filename: string, options: DubOptions): Promise<DubResult> {
  const id = randomUUID();
  const tempDir = path.join(tmpdir(), `dub_${id}`);
  await fs.mkdir(tempDir, { recursive: true });

  if (!isPathWithinDir(tempDir, tmpdir())) {
    throw new Error("Invalid temp directory.");
  }

  const tempVideoPath = path.join(tempDir, `input_${id}.mp4`);
  const tempAudioExtract = path.join(tempDir, `extracted_${id}.mp3`);
  const tempTTSAudio = path.join(tempDir, `tts_${id}.mp3`);
  const tempSrtPath = path.join(tempDir, `subtitle_${id}.srt`);
  const tempOutputPath = path.join(tempDir, `output_${id}.mp4`);

  try {
    await fs.writeFile(tempVideoPath, videoBuffer);
    console.log(`[Dubber 5%] Video saved: ${Math.round(videoBuffer.length / 1024)}KB | RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);

    console.log(`[Dubber 10%] Extracting audio...`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .on('end', () => resolve())
        .on('error', reject)
        .save(tempAudioExtract);
    });

    console.log(`[Dubber 20%] Transcribing with whisper base... | RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
    
    // ... (rest of the transcription and translation logic) ...

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(tempVideoPath);
      cmd = cmd.input(tempTTSAudio);

      const filters: string[] = [];

      // ... (filter building logic) ...

      if (filters.length > 0) {
        cmd = cmd
          .complexFilter(filters.join(';'))
          .outputOptions([
            '-map', filters.some(f => f.includes('[vfinal]')) ? '[vfinal]' : '0:v',
            '-map', '1:a',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-shortest',
          ]);
      }

      // Set timeout for FFmpeg (10 minutes max)
      const ffmpegTimeout = 10 * 60 * 1000;
      let ffmpegFinished = false;

      cmd
        .on('start', (cmdline: string) => console.log(`[Dubber] FFmpeg cmd:`, cmdline.slice(0, 200)))
        .on('progress', (progress: any) => {
          if (progress.percent) {
            console.log(`[Dubber 80-100%] FFmpeg progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => { ffmpegFinished = true; resolve(); })
        .on('error', (err: Error) => { reject(err); })
        .timeout(ffmpegTimeout / 1000) // fluent-ffmpeg timeout is in seconds
        .save(tempOutputPath);
    });

    // ... (rest of the file saving and return logic) ...

  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
