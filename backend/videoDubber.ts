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
    const whisperResult = await transcribeLocalWhisper(tempAudioExtract);
    const englishText = whisperResult.text;
    const whisperSegments = whisperResult.segments;
    if (!englishText?.trim()) throw new Error("Whisper could not detect any speech.");
    console.log(`[Dubber 30%] Transcribed ${whisperSegments.length} segments`);

    console.log(`[Dubber 35%] Translating ${whisperSegments.length} segments... | RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
    const { translated: translatedSegments } = await geminiTranslateForDub(whisperSegments, options.userApiKey);
    console.log(`[Dubber 50%] Translation complete`);
    
    // Verify translation worked - check if we got Burmese text
    const myanmarText = translatedSegments.map(s => s.text).join(" ");
    if (myanmarText.length < englishText.length * 0.5) {
      throw new Error("Translation failed: Gemini returned empty or invalid response. Please try again.");
    }
    
    // Apply gapless timing: current.end = next.start
    for (let i = 0; i < translatedSegments.length - 1; i++) {
      translatedSegments[i].end = translatedSegments[i + 1].start;
    }

    console.log(`[Dubber 55%] Generating TTS (voice=${options.character || options.voice}, speed=${options.speed}, pitch=${options.pitch})... | RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
    let ttsResult;
    if (options.character && options.character.trim()) {
      ttsResult = await generateSpeechWithCharacter(myanmarText, options.character as CharacterKey, options.speed, "16:9", options.pitch);
    } else {
      ttsResult = await generateSpeech(myanmarText, options.voice, options.speed, options.pitch, "16:9");
    }
    await fs.writeFile(tempTTSAudio, ttsResult.audioBuffer);
    console.log(`[Dubber 70%] TTS generated (${Math.round(ttsResult.durationMs/1000)}s)`);
    
    // Get exact TTS duration for precise SRT scaling
    const exactTtsDurationSec = ttsResult.durationMs / 1000;
    const whisperEndTime = whisperSegments.length > 0 
      ? Math.max(...whisperSegments.map(s => s.end)) 
      : 0;
    const durationRatio = whisperEndTime > 0 ? exactTtsDurationSec / whisperEndTime : 1.0;
    console.log(`[Dubber 72%] Exact sync: TTS=${exactTtsDurationSec.toFixed(2)}s, Whisper=${whisperEndTime.toFixed(2)}s, Ratio=${durationRatio.toFixed(3)}`)

    const videoDuration = await getVideoDuration(tempVideoPath);
    const audioDuration = await getAudioDuration(tempTTSAudio);
    console.log(`[Dubber 75%] Video: ${videoDuration.toFixed(1)}s, Audio: ${audioDuration.toFixed(1)}s`);

    // Use EXACT TTS duration for perfect sync
    const speedRatio = videoDuration / exactTtsDurationSec;
    const needSpeedAdjust = Math.abs(speedRatio - 1.0) > 0.02;
    console.log(`[Dubber 80%] Combining video + audio + SRT (ratio: ${speedRatio.toFixed(3)})... | RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);

    let srtContent = "";
    if (options.srtEnabled) {
      // Build SRT with EXACT scaled timestamps using precise TTS duration ratio
      srtContent = buildSrtFromTranslatedSegments(translatedSegments, durationRatio);
      const BOM = '\uFEFF';
      await fs.writeFile(tempSrtPath, BOM + srtContent, 'utf-8');
      console.log(`[Dubber 78%] SRT timestamps scaled by ${durationRatio.toFixed(4)} for exact sync`);
    }

    console.log(`[Dubber] Combining video + TTS audio${needSpeedAdjust ? ` (speed adjust: ${speedRatio.toFixed(2)}x)` : ""}${options.srtEnabled ? " + SRT" : ""}...`);

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(tempVideoPath);
      cmd = cmd.input(tempTTSAudio);

      const filters: string[] = [];

      if (needSpeedAdjust) {
        const clampedRatio = Math.max(0.5, Math.min(2.0, speedRatio));
        filters.push(`[0:v]setpts=PTS/${clampedRatio}[vspeed]`);
      }

      const videoLabel = needSpeedAdjust ? "[vspeed]" : "[0:v]";

      if (options.srtEnabled && existsSync(tempSrtPath)) {
        // Use exact values from frontend (no defaults)
        const fontSize = options.srtFontSize ?? 24;
        const fontColor = hexToASS(options.srtColor || "#ffffff");
        // srtMarginV 0-200 from frontend maps to FFmpeg MarginV 0-720 (for 720p video)
        const marginV = Math.round((options.srtMarginV ?? 30) * 3.6);
        const shadowStr = options.srtDropShadow !== false ? ",Shadow=2,BackColour=&H80000000" : ",Shadow=0";

        const blurColor = options.srtBlurColor === "white" ? "FFFFFF" : "000000";
        const blurAlpha = options.srtBlurBg !== false ? Math.min(255, Math.max(0, Math.round((options.srtBlurSize ?? 8) * 16))).toString(16).toUpperCase().padStart(2, '0') : 'FF';
        const borderStyle = options.srtBlurBg !== false ? `,BorderStyle=4,BackColour=&H${blurAlpha}${blurColor},Outline=0` : ",BorderStyle=1,Outline=2,OutlineColour=&H40000000";

        const marginLR = options.srtFullWidth ? ",MarginL=0,MarginR=0" : "";
        const escapedSrtPath = tempSrtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        const myanmarFont = "Fontname=Noto Sans Myanmar";
        const encoding = ",Encoding=1";

        filters.push(`${videoLabel}subtitles='${escapedSrtPath}':force_style='${myanmarFont},FontSize=${fontSize},PrimaryColour=${fontColor},Alignment=2,MarginV=${marginV}${marginLR}${shadowStr}${borderStyle}${encoding}'[vfinal]`);
      } else {
        if (needSpeedAdjust) {
          filters.push(`${videoLabel}null[vfinal]`);
        }
      }

      if (filters.length > 0) {
        cmd = cmd
          .complexFilter(filters.join(';'))
          .outputOptions([
            '-map', filters.some(f => f.includes('[vfinal]')) ? '[vfinal]' : '0:v',
            '-map', '1:a',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-shortest',
          ]);
      } else {
        cmd = cmd
          .outputOptions([
            '-map', '0:v',
            '-map', '1:a',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-shortest',
          ]);
      }

      cmd
        .on('start', (cmdline: string) => console.log(`[Dubber] FFmpeg cmd:`, cmdline.slice(0, 200)))
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(tempOutputPath);
    });

    const outputBuffer = await fs.readFile(tempOutputPath);
    console.log(`[Dubber 100%] ✅ Done! Output: ${Math.round(outputBuffer.length / 1024 / 1024 * 10) / 10}MB`);

    return {
      videoBase64: outputBuffer.toString('base64'),
      myanmarText,
      srtContent,
      durationMs: ttsResult.durationMs,
    };

  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ───── MAIN: Dub video from URL ─────
export async function dubVideoFromLink(url: string, options: DubOptions): Promise<DubResult> {
  if (!isAllowedVideoUrl(url)) {
    throw new Error("ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။");
  }

  const id = randomUUID();
  const tempVideoPath = path.join(tmpdir(), `dub_dl_${id}.mp4`);

  if (!isPathWithinDir(tempVideoPath, tmpdir())) {
    throw new Error("Invalid temp directory.");
  }

  try {
    console.log(`[Dubber] Downloading video from: ${url}`);

    const cookiePath = path.join(process.cwd(), 'cookies.txt');
    const hasCookies = existsSync(cookiePath);

    // 🌐 Proxy support — builds from separate credentials
    const proxyHost = process.env.YTDLP_PROXY_HOST;
    const proxyPort = process.env.YTDLP_PROXY_PORT;
    const proxyUser = process.env.YTDLP_PROXY_USER;
    const proxyPass = process.env.YTDLP_PROXY_PASS;
    const proxyUrl = (proxyHost && proxyPort && proxyUser && proxyPass)
      ? `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`
      : "";
    if (proxyUrl) {
      console.log(`[Dubber] Using proxy: ${proxyHost}:${proxyPort}`);
    }

    console.log(`[Dubber] Downloading: ${url}`);

    const dlResult = await downloadVideo(url, tempVideoPath, {
      cookiesPath: hasCookies ? cookiePath : undefined,
      timeout: 300000
    });

    if (!dlResult.success) {
      throw new Error(`Download failed: ${dlResult.error}`);
    }

    const videoBuffer = await fs.readFile(tempVideoPath);
    return await dubVideoFromBuffer(videoBuffer, `downloaded_${id}.mp4`, options);

  } finally {
    await fs.unlink(tempVideoPath).catch(() => {});
  }
}
