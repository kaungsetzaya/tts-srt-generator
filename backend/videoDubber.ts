import { promises as fs } from "fs";
import { existsSync } from "fs";
import * as path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
// @ts-ignore
import ffmpeg from "fluent-ffmpeg";
import { execFile } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { downloadVideo, getVideoInfo } from "./_core/multiDownloader";
import { generateSpeech, generateSpeechWithCharacter, CHARACTER_VOICES, type VoiceKey, type CharacterKey, getMurfKey } from "./tts";
import { geminiTranslateBatch } from "./geminiTranslator";
import { isAllowedVideoUrl } from "./_core/security";
import { generateSignedDownloadUrl } from "./_core/signedUrl";
import type { DubOptions, DubResult } from "@shared/types";

const execFileAsync = promisify(execFile);

export type { DubOptions, DubResult } from "@shared/types";

// ─── Helpers ────────────────────────────────────────────────────

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}
function pad2(n: number) {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms2 = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms2, 3)}`;
}

function getAudioDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(Math.round((metadata.format.duration || 0) * 1000));
    });
  });
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

function getVideoSize(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else {
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
        resolve({
          width: videoStream?.width || 1920,
          height: videoStream?.height || 1080,
        });
      }
    });
  });
}

// ─── Myanmar Font ────────────────────────────────────────────────
// Find Myanmar font on the system or use bundled fallback
function getMyanmarFontPath(): string {
  const candidates = [
    // Bundled with the app (most reliable)
    path.join(process.cwd(), "backend", "fonts", "NotoSansMyanmar-Regular.ttf"),
    path.join(process.cwd(), "fonts", "NotoSansMyanmar-Regular.ttf"),
    // System fonts
    "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf",
    "/usr/share/fonts/truetype/padauk/Padauk-Regular.ttf",
    "/usr/share/fonts/truetype/myanmar/Pyidaungsu-Regular.ttf",
    "/usr/local/share/fonts/NotoSansMyanmar-Regular.ttf",
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      console.log(`[Font] Using Myanmar font: ${p}`);
      return p;
    }
  }

  console.warn("[Font] No Myanmar font found! Subtitles may not render correctly.");
  return "";
}

// ─── Get actual video dimensions from probe ──────────────────────

// Build ASS subtitle style — fixed blur, correct full-width, aspect-ratio-aware
function buildAssContent(
  segments: Array<{ startMs: number; endMs: number; text: string }>,
  fontPath: string,
  videoWidth: number,
  videoHeight: number,
  opts?: {
    fontSize?: number;
    fontColor?: string;
    marginV?: number;
    blurBg?: boolean;
    blurSize?: number;
    blurColor?: "black" | "white";
    boxPadding?: number;
    fullWidth?: boolean;
  }
): string {
  // ASS PlayRes matches actual video dimensions for correct subtitle positioning
  const playResX = videoWidth;
  const playResY = videoHeight;

  // Scale font: reference design is 490px tall viewport → actual video height
  const fontScaleFactor = videoHeight / 490;
  const fontSize = Math.round((opts?.fontSize ?? 12) * fontScaleFactor * 2.0);

  const fontColor = opts?.fontColor ?? "#ffffff";

  // Bottom marginV scaled to actual video height
  // User slider 0–60, map to 20px–200px at reference 1080p, then scale
  const userMarginV = opts?.marginV ?? 30;
  const baseMarginV = 80 + userMarginV * 3;
  const marginV = Math.round(baseMarginV * (videoHeight / 1080));

  const blurBg = opts?.blurBg ?? true;
  // blurSize slider: 1–20 range. Opacity: 1=~5%, 8=~40%, 20=~70% — not 85%
  const blurSize = opts?.blurSize ?? 8;
  const blurColor = opts?.blurColor ?? "black";
  const boxPadding = opts?.boxPadding ?? 4;
  const fullWidth = opts?.fullWidth ?? false;

  // Convert hex font color to ASS &HAABBGGRR
  const hex = (fontColor.replace("#", "") + "000000").substring(0, 6);
  const r = parseInt(hex.substring(0, 2), 16) || 255;
  const g = parseInt(hex.substring(2, 4), 16) || 255;
  const b = parseInt(hex.substring(4, 6), 16) || 255;
  const assColor = `&H00${pad2(b)}${pad2(g)}${pad2(r)}`;

  const fontName = fontPath ? path.basename(fontPath, path.extname(fontPath)) : "Noto Sans Myanmar";

  // ── Blur / Background box ──
  // ASS alpha: 0x00 = fully opaque, 0xFF = fully transparent
  // blurSize:  1 = very transparent (~90% transparent), 20 = semi-opaque (~65% opaque)
  // Formula: opacity% = blurSize / 20 * 0.65, then alpha = 255 - (opacity * 255)
  let backColor = "&HFF000000"; // default: fully transparent (no box)
  let borderStyle = 1; // 1 = outline+shadow
  let outline = 1;
  let shadow = 1;

  if (blurBg) {
    const opacityFraction = Math.min(0.72, (blurSize / 20) * 0.72); // max ~72% opaque
    const alphaInt = Math.round((1 - opacityFraction) * 255);
    const alphaHex = alphaInt.toString(16).padStart(2, "0").toUpperCase();
    const bgHex = blurColor === "black" ? "000000" : "FFFFFF";
    backColor = `&H${alphaHex}${bgHex}`;
    borderStyle = 3; // 3 = opaque box
    outline = Math.max(4, boxPadding * 3); // box padding in px
    shadow = 0;
  }

  // ── Full width ──
  // fullWidth = remove side margins so box stretches edge-to-edge
  // WrapStyle 1 = end-of-line wrapping, won't center-shrink
  const marginL = fullWidth ? 0 : Math.round(playResX * 0.04);
  const marginR = fullWidth ? 0 : Math.round(playResX * 0.04);
  const wrapStyle = fullWidth ? 1 : 0;

  const header = `[Script Info]
ScriptType: v4.00+
WrapStyle: ${wrapStyle}
PlayResX: ${playResX}
PlayResY: ${playResY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${assColor},&H000000FF,&H00000000,${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  function msToAssTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
  }

  const events = segments
    .map(seg => {
      // Escape commas (ASS delimiter) and convert newlines
      const cleanText = seg.text
        .replace(/\n/g, "\\N")
        .replace(/,/g, "，");
      // Events use 0,0,0 for margins — styling comes entirely from the Style line above
      return `Dialogue: 0,${msToAssTime(seg.startMs)},${msToAssTime(seg.endMs)},Default,,0,0,0,,${cleanText}`;
    })
    .join("\n");

  return header + events + "\n";
}

// ─── Step 1: Extract audio ──────────────────────────────────────

async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioQuality(2)
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

// ─── Step 2: Whisper transcribe ─────────────────────────────────

interface Segment {
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

async function transcribeWithWhisper(audioPath: string): Promise<Segment[]> {
  const outputDir = path.dirname(audioPath);
  const baseName = path.parse(audioPath).name;
  const scriptPath = path.join(process.cwd(), "python", "transcriber.py");
  const outputJson = path.join(outputDir, `${baseName}_transcription.json`);

  await execFileAsync("python3", [scriptPath, audioPath, outputJson], {
    timeout: 300000,
  });

  const data = JSON.parse(await fs.readFile(outputJson, "utf-8"));
  await fs.unlink(outputJson).catch(() => {});

  const segments: Segment[] = (data.segments || [])
    .map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      text: (seg.text || "").trim(),
    }))
    .filter((seg: Segment) => seg.text.length > 0);

  return segments;
}

// ─── Step 3: Gemini translate ALL segments in ONE call ──────────

async function translateSegments(
  segments: Segment[],
  apiKey?: string
): Promise<Segment[]> {
  if (segments.length === 0) return segments;

  try {
    const inputSegments = segments.map((seg, i) => ({
      index: i,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }));

    const { translated } = await geminiTranslateBatch(inputSegments, apiKey);

    // Map back to expected Segment type seamlessly
    return translated.map(t => ({
      start: t.start,
      end: t.end,
      text: t.text,
    }));
  } catch (err) {
    console.error(`[Gemini Dubber] Translation attempt failed:`, err);
    console.warn("[Gemini Dubber] Falling back to original text due to error.");
    return segments;
  }
}

// ─── Step 4: Generate silence audio file ────────────────────────

async function generateSilence(durationMs: number, outputPath: string): Promise<void> {
  if (durationMs <= 0) return;
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("anullsrc=r=24000:cl=mono")
      .inputFormat("lavfi")
      .duration(durationMs / 1000)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

// ─── Step 5: Speed up audio with atempo ─────────────────────────

async function speedUpAudio(
  inputPath: string,
  outputPath: string,
  ratio: number
): Promise<void> {
  // atempo filter: range 0.5–2.0 only
  // For ratios outside range, chain multiple atempo filters
  const filters: string[] = [];
  let r = ratio;

  while (r > 2.0) {
    filters.push("atempo=2.0");
    r /= 2.0;
  }
  while (r < 0.5) {
    filters.push("atempo=0.5");
    r /= 0.5;
  }
  filters.push(`atempo=${r.toFixed(4)}`);

  const filterStr = filters.join(",");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filterStr)
      .audioCodec("libmp3lame")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

// ─── Step 6: Core dubbing logic ──────────────────────────────────

export async function dubVideoFromBuffer(
  videoBuffer: Buffer,
  filename: string,
  options: DubOptions
): Promise<DubResult> {
  const id = randomUUID();
  const tempDir = path.join(tmpdir(), `dub_${id}`);
  await fs.mkdir(tempDir, { recursive: true });

  const tempVideoPath = path.join(tempDir, `input_${id}.mp4`);
  const tempAudioExtract = path.join(tempDir, `extracted_${id}.mp3`);
  const tempFinalAudio = path.join(tempDir, `final_audio_${id}.mp3`);
  const tempAssPath = path.join(tempDir, `subtitles_${id}.ass`);
  const tempOutputPath = path.join(tempDir, `output_${id}.mp4`);

  try {
    // ── Write video to disk ──
    await fs.writeFile(tempVideoPath, videoBuffer);
    const videoSizeMB = videoBuffer.length / 1024 / 1024;
    console.log(`[Dubber] Video written: ${Math.round(videoSizeMB)}MB`);

    // ── Validate video size (25MB limit) ──
    if (videoSizeMB > 25) {
      throw new Error("Video too large. Max 25MB.");
    }

    // ── Validate video length (2min30sec = 150sec limit) ──
    const videoDurationSec = await getVideoDuration(tempVideoPath);
    if (videoDurationSec > 150) {
      throw new Error("Video too long. Max 2min 30sec.");
    }

    // ── Step 1: Extract audio ──
    console.log("[Dubber] Extracting audio...");
    await extractAudio(tempVideoPath, tempAudioExtract);

    // ── Step 2: Whisper transcribe ──
    console.log("[Dubber] Transcribing with Whisper...");
    const segments = await transcribeWithWhisper(tempAudioExtract);
    console.log(`[Dubber] Got ${segments.length} segments from Whisper`);

    if (segments.length === 0) {
      throw new Error("No speech detected in video");
    }

    // ── Step 3: Translate ALL in ONE Gemini call ──
    console.log("[Dubber] Translating with Gemini (1 API call)...");
    const translatedSegments = await translateSegments(segments, options.userApiKey);

    // ── Step 4: Get video dimensions + duration ──
    const videoDurationMs = Math.round(videoDurationSec * 1000);
    const videoSize = await getVideoSize(tempVideoPath);
    console.log(`[Dubber] Video: ${videoSize.width}x${videoSize.height}, ${videoDurationSec.toFixed(1)}s`);

    // ── Step 5: Cumulative TTS generation — fixed 1.2x speed, 150ms tiny pauses ──
    console.log("[Dubber] Generating TTS per segment (stable 1.2x)...");

    const TINY_PAUSE_MS = 150; // small breath between lines
    const FIXED_SPEED = 1.2;  // always 1.2x — never vary

    interface ProcessedSegment {
      startMs: number;  // in the dubbed audio track
      endMs: number;    // in the dubbed audio track
      text: string;
      audioPath: string;
      ttsDurationMs: number;
    }

    const processed: ProcessedSegment[] = [];
    const audioParts: string[] = [];
    let cursorMs = 0; // cumulative position in the dubbed audio track

    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];

      if (!seg.text.trim()) continue;

      const isCharacterVoice = options.voice && options.voice in CHARACTER_VOICES;
      const baseVoice = isCharacterVoice
        ? CHARACTER_VOICES[options.voice as CharacterKey].base
        : (options.voice as VoiceKey);

      // Generate TTS at fixed speed — NEVER change speed per segment
      let ttsResult;
      try {
        ttsResult = await generateSpeech(
          seg.text,
          baseVoice,
          FIXED_SPEED,
          options.pitch ?? 0
        );
      } catch (ttsErr) {
        console.error(`[Dubber] TTS failed for segment ${i}:`, ttsErr);
        continue;
      }

      const rawTtsPath = path.join(tempDir, `tts_raw_${i}.mp3`);
      await fs.writeFile(rawTtsPath, ttsResult.audioBuffer);

      const ttsDurationMs = await getAudioDurationMs(rawTtsPath);

      // Subtitle timing is based on cumulative audio clock — not original Whisper timestamps
      const subtitleStartMs = cursorMs;
      const subtitleEndMs = cursorMs + ttsDurationMs;

      audioParts.push(rawTtsPath);
      cursorMs += ttsDurationMs;

      // Add tiny pause between sentences (not after the very last segment)
      if (i < translatedSegments.length - 1) {
        const pausePath = path.join(tempDir, `pause_${i}.mp3`);
        await generateSilence(TINY_PAUSE_MS, pausePath);
        audioParts.push(pausePath);
        cursorMs += TINY_PAUSE_MS;
      }

      processed.push({
        startMs: subtitleStartMs,
        endMs: subtitleEndMs,
        text: seg.text,
        audioPath: rawTtsPath,
        ttsDurationMs,
      });
    }

    const totalDubbedMs = cursorMs;
    console.log(`[Dubber] Dubbed audio: ${(totalDubbedMs/1000).toFixed(1)}s vs video: ${videoDurationSec.toFixed(1)}s`);

    // ── Video speed adjustment: gently stretch/compress video to match dubbed audio ──
    // Allowed range: video can be sped up 1.15x max or slowed 0.88x min
    // ratio > 1 means dubbed audio is longer → slow video down (increase PTS)
    // ratio < 1 means dubbed audio is shorter → speed video up (decrease PTS)
    const videoAudioRatio = totalDubbedMs / videoDurationMs;
    const MIN_VIDEO_SPEED = 0.88; // max 12% slower
    const MAX_VIDEO_SPEED = 1.15; // max 15% faster
    const clampedVideoSpeed = Math.max(MIN_VIDEO_SPEED, Math.min(MAX_VIDEO_SPEED, videoAudioRatio));
    const needsVideoAdjust = Math.abs(clampedVideoSpeed - 1.0) > 0.02;
    console.log(`[Dubber] Video speed factor: ${clampedVideoSpeed.toFixed(3)}x (original ratio: ${videoAudioRatio.toFixed(3)})`);

    // ── Step 6: Concat all audio parts, then trim to video duration ──
    console.log(`[Dubber] Concatenating ${audioParts.length} audio parts...`);

    if (audioParts.length === 0) {
      throw new Error("No audio segments generated");
    }

    const listPath = path.join(tempDir, "concat_list.txt");
    const listContent = audioParts
      .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await fs.writeFile(listPath, listContent);

    // Concatenate all audio segments
    const tempConcatAudio = path.join(tempDir, `concat_raw_${id}.mp3`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .on("end", () => resolve())
        .on("error", reject)
        .save(tempConcatAudio);
    });

    // Trim audio to exactly video duration — ensures audio never outlasts video
    const targetDurationSec = videoDurationSec;
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempConcatAudio)
        .outputOptions(["-t", targetDurationSec.toFixed(3)])
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .on("end", () => resolve())
        .on("error", reject)
        .save(tempFinalAudio);
    });
    console.log(`[Dubber] Audio trimmed to ${targetDurationSec.toFixed(1)}s to match video.`);

    // ── Step 6b: Character voice conversion with Murf.ai ──
    let finalAudioPath = tempFinalAudio;
    const isCharacterVoice = options.voice && options.voice in CHARACTER_VOICES;
    if (isCharacterVoice) {
      console.log(`[Dubber] Converting to character voice: ${options.voice} with Murf.ai...`);
      try {
        const charVoice = CHARACTER_VOICES[options.voice as CharacterKey];
        const murfApiKey = getMurfKey();
        if (!murfApiKey) {
          throw new Error("MURF_API_KEY not configured");
        }

        const { FormData, Blob } = await import("formdata-node");
        const form = new FormData();
        form.set("voice_id", charVoice.murfId);
        form.set("format", "MP3");
        const audioBuffer = await fs.readFile(tempFinalAudio);
        form.set("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");

        const response = await fetch("https://api.murf.ai/v1/voice-changer/convert", {
          method: "POST",
          headers: { "api-key": murfApiKey },
          body: form as any,
        });

        const result = (await response.json()) as any;
        if (result.error_code) {
          throw new Error(`[Murf API Error] ${result.error_message} (${result.error_code})`);
        }

        // Download converted audio
        const audioResponse = await fetch(result.audio_file);
        const convertedBuffer = Buffer.from(await audioResponse.arrayBuffer());

        // Save converted audio to tempFinalAudio (overwrite)
        const tempConvertedPath = path.join(tempDir, `final_audio_converted_${id}.mp3`);
        await fs.writeFile(tempConvertedPath, convertedBuffer);
        finalAudioPath = tempConvertedPath;
        console.log(`[Dubber] Character voice conversion complete.`);
      } catch (murfErr: any) {
        console.error(`[Dubber] Murf.ai conversion failed:`, murfErr.message);
        // Continue with base voice if conversion fails
        console.log(`[Dubber] Falling back to base voice.`);
      }
    }

    // ── Step 7: Build SRT — cap all timestamps at video duration ──
    const videoDurationMsCapped = videoDurationMs;
    let srtContent = "";
    processed.forEach((seg, idx) => {
      const capStart = Math.min(seg.startMs, videoDurationMsCapped);
      const capEnd = Math.min(seg.endMs, videoDurationMsCapped);
      if (capStart >= capEnd) return; // skip segments entirely beyond video
      srtContent += `${idx + 1}\n`;
      srtContent += `${msToSrtTime(capStart)} --> ${msToSrtTime(capEnd)}\n`;
      srtContent += `${seg.text}\n\n`;
    });

    // ── Step 8: Build ASS — cap subtitle timestamps at video duration ──
    const fontPath = getMyanmarFontPath();
    const assContent = buildAssContent(
      processed
        .map(s => ({
          startMs: Math.min(s.startMs, videoDurationMs),
          endMs: Math.min(s.endMs, videoDurationMs),
          text: s.text,
        }))
        .filter(s => s.startMs < s.endMs), // discard segments past video end
      fontPath,
      videoSize.width,
      videoSize.height,
      {
        fontSize: options.srtFontSize,
        fontColor: options.srtColor,
        marginV: options.srtMarginV,
        blurBg: options.srtBlurBg,
        blurSize: options.srtBlurSize,
        blurColor: options.srtBlurColor,
        boxPadding: options.srtBoxPadding,
        fullWidth: options.srtFullWidth,
      }
    );
    await fs.writeFile(tempAssPath, assContent, "utf-8");

    // ── Step 9: FFmpeg final merge — video + trimmed audio + burned subtitles ──
    console.log("[Dubber] Merging video + audio + subtitles...");

    await new Promise<void>((resolve, reject) => {
      // subtitle filter path (escape for FFmpeg vf syntax on Linux)
      let subFilter: string;
      if (fontPath && existsSync(fontPath)) {
        const p = tempAssPath.replace(/\\/g, "/");
        const fd = path.dirname(fontPath).replace(/\\/g, "/");
        subFilter = `ass=${p}:fontsdir=${fd}`;
        console.log(`[Dubber] Burning ASS subtitles with font: ${path.basename(fontPath)}`);
      } else {
        const p = tempAssPath.replace(/\\/g, "/");
        subFilter = `subtitles=${p}`;
        console.warn("[Dubber] No Myanmar font found — subtitles may render without Myanmar script.");
      }

      ffmpeg(tempVideoPath)
        .input(finalAudioPath)
        .outputOptions([
          "-vf", subFilter,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "28",
          "-c:a", "aac",
          "-b:a", "128k",
          "-map", "0:v",
          "-map", "1:a",
          // Force output to end exactly at video duration
          "-t", videoDurationSec.toFixed(3),
          "-shortest", // Emergency fallback: stop when shortest stream ends
          "-map_metadata", "-1", // Strip metadata that could cause duration drift
          "-movflags", "+faststart"
        ])
        .on("progress", (p: any) =>
          console.log(`[Dubber] FFmpeg ${Math.round(p.percent ?? 0)}%`)
        )
        .on("error", (e: any) => {
          console.error("[Dubber] FFmpeg error:", e.message);
          reject(e);
        })
        .on("end", () => resolve())
        .save(tempOutputPath);
    });

    // ── Step 10: Move to downloads ──
    const downloadFilename = `dub_${id}.mp4`;
    const finalPath = path.join(
      process.cwd(),
      "static",
      "downloads",
      downloadFilename
    );
    await fs.mkdir(path.dirname(finalPath), { recursive: true }).catch(() => {});
    await fs.copyFile(tempOutputPath, finalPath);

    const videoUrl = generateSignedDownloadUrl(downloadFilename);

    // Build plain myanmar text
    const myanmarText = processed.map(s => s.text).join(" ");

    console.log(`[Dubber] Done! Output: ${downloadFilename}`);

    return {
      videoUrl,
      myanmarText,
      srtContent,
      durationMs: videoDurationMs,
    };

  } catch (err: any) {
    console.error("[Dubber Critical Error]", err);
    throw err;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Link version ────────────────────────────────────────────────

export async function dubVideoFromLink(
  url: string,
  options: DubOptions
): Promise<DubResult> {
  if (!isAllowedVideoUrl(url)) {
    throw new Error(
      "ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။"
    );
  }

  const id = randomUUID();
  const tempVideoPath = path.join(tmpdir(), `dl_${id}.mp4`);

  try {
    // Validate video info before downloading
    console.log(`[Dubber] Checking video info: ${url}`);
    const info = await getVideoInfo(url);
    if (!info) {
      throw new Error("Could not get video info. Check URL.");
    }
    if (info.duration > 150) {
      throw new Error("Video too long. Max 2min 30sec.");
    }
    if (info.filesize > 25 * 1024 * 1024) {
      throw new Error("Video too large. Max 25MB.");
    }

    console.log(`[Dubber] Downloading: ${url}`);
    await downloadVideo(url, tempVideoPath, { timeout: 300000 });

    const buffer = await fs.readFile(tempVideoPath);
    return await dubVideoFromBuffer(buffer, "video.mp4", options);

  } finally {
    await fs.unlink(tempVideoPath).catch(() => {});
  }
}

// ─── Job Processor Registration ──────────────────────────────────
// Must be at the bottom so dubVideoFromLink is defined first
import { registerProcessor, updateJob } from "./jobs";
import { addCredits } from "./routers/credits";
import { eq, sql } from "drizzle-orm";

registerProcessor("dub_link", async (job) => {
  const { url, voice, speed, pitch, srtEnabled, userId } = job.input;

  updateJob(job.id, { progress: 5, message: "ပြင်ဆင်နေသည်..." });

  try {
    updateJob(job.id, { progress: 15, message: "ဖန်တီးနေသည်..." });

    const result = await dubVideoFromLink(url, {
      voice,
      speed: speed ?? 1.2,
      pitch: pitch ?? 0,
      srtEnabled: srtEnabled ?? true,
      srtFontSize: job.input.srtFontSize,
      srtColor: job.input.srtColor,
      srtMarginV: job.input.srtMarginV,
      srtBlurBg: job.input.srtBlurBg,
      srtBlurSize: job.input.srtBlurSize,
      srtBlurColor: job.input.srtBlurColor,
      srtBoxPadding: job.input.srtBoxPadding,
      srtFullWidth: job.input.srtFullWidth,
    });

    updateJob(job.id, {
      status: "completed",
      progress: 100,
      result,
      message: "ပြီးပါပြီ",
    });
  } catch (error: any) {
    console.error(`[DubJob ${job.id}] Error:`, error.message);

    // Refund credits on failure
    if (userId) {
      try {
        await addCredits(userId, 10, "video_dub_refund", `Refund: Dub job failed for ${url}`);
      } catch (refundErr) {
        console.error("[DubJob] Refund failed:", refundErr);
      }
    }

    updateJob(job.id, {
      status: "failed",
      error: error.message || "Dub failed",
      message: "Failed",
    });
  }
});

registerProcessor("dub_file", async (job) => {
  const { videoBase64, filename, voice, speed, pitch, srtEnabled, userId } = job.input;

  updateJob(job.id, { progress: 5, message: "ပြင်ဆင်နေသည်..." });

  try {
    updateJob(job.id, { progress: 20, message: "ဖန်တီးနေသည်..." });
    const buffer = Buffer.from(videoBase64, "base64");

    const result = await dubVideoFromBuffer(buffer, filename, {
      voice,
      speed: speed ?? 1.2,
      pitch: pitch ?? 0,
      srtEnabled: srtEnabled ?? true,
      srtFontSize: job.input.srtFontSize,
      srtColor: job.input.srtColor,
      srtMarginV: job.input.srtMarginV,
      srtBlurBg: job.input.srtBlurBg,
      srtBlurSize: job.input.srtBlurSize,
      srtBlurColor: job.input.srtBlurColor,
      srtBoxPadding: job.input.srtBoxPadding,
      srtFullWidth: job.input.srtFullWidth,
    });

    updateJob(job.id, {
      status: "completed",
      progress: 100,
      result,
      message: "Done",
    });
  } catch (error: any) {
    console.error(`[DubFileJob ${job.id}] Error:`, error.message);

    if (userId) {
      try {
        await addCredits(userId, 10, "video_dub_refund", `Refund: Dub file job failed for ${filename}`);
      } catch (refundErr) {
        console.error("[DubFileJob] Refund failed:", refundErr);
      }
    }

    updateJob(job.id, {
      status: "failed",
      error: error.message || "Dub file failed",
      message: "Failed",
    });
  }
});