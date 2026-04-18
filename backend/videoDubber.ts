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
import { downloadVideo } from "./_core/multiDownloader";
import { generateSpeech, type VoiceKey } from "./tts";
import { isAllowedVideoUrl } from "./_core/security";
import type { DubOptions, DubResult } from "@shared/types";

const execFileAsync = promisify(execFile);

export type { DubOptions, DubResult } from "@shared/types";

// ─── Helpers ────────────────────────────────────────────────────

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
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

// Build ASS subtitle style with Myanmar font embedded
// ASS format gives us more control than SRT for font rendering
function buildAssContent(
  segments: Array<{ startMs: number; endMs: number; text: string }>,
  fontPath: string
): string {
  const fontName = fontPath
    ? path.basename(fontPath, path.extname(fontPath))
    : "Noto Sans Myanmar";

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,20,20,40,1

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
      const cleanText = seg.text
        .replace(/\n/g, "\\N")
        .replace(/,/g, "，"); // ASS uses comma as delimiter — escape
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
  const scriptPath = path.join(process.cwd(), "backend", "transcriber.py");
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

  const genAI = new GoogleGenerativeAI(
    apiKey || process.env.GEMINI_API_KEY || ""
  );
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

  // Build indexed prompt — ALL segments in ONE call
  const indexedText = segments
    .map((seg, i) => `[${i}] ${seg.text}`)
    .join("\n");

  const prompt = `Translate ALL the following video segments to Myanmar (Burmese) language.

RULES:
1. Return ONLY a JSON array — no extra text, no markdown, no explanation
2. Keep the same index numbers [0], [1], [2]...
3. Each item: {"i": number, "text": "myanmar translation"}
4. NO quotes around Myanmar text
5. NO "..." dots or suspension marks
6. Keep the translation natural and conversational
7. If a segment is already Myanmar, keep it as is

Segments to translate:
${indexedText}

Return JSON array only:`;

  let retries = 2;
  while (retries >= 0) {
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array in response");

      const parsed: Array<{ i: number; text: string }> = JSON.parse(jsonMatch[0]);

      // Map back to segments using index
      const translated = segments.map((seg, i) => {
        const found = parsed.find(p => p.i === i);
        return {
          ...seg,
          text: found?.text?.trim() || seg.text, // fallback to original
        };
      });

      console.log(`[Gemini] Translated ${translated.length} segments in 1 API call`);
      return translated;

    } catch (err) {
      console.error(`[Gemini] Translation attempt failed (retries left: ${retries}):`, err);
      retries--;
      if (retries < 0) {
        console.warn("[Gemini] All retries failed — using original text");
        return segments; // fallback: use original
      }
      await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
    }
  }

  return segments;
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
    console.log(`[Dubber] Video written: ${Math.round(videoBuffer.length / 1024 / 1024)}MB`);

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

    // ── Step 4: Get video duration ──
    const videoDurationSec = await getVideoDuration(tempVideoPath);
    const videoDurationMs = Math.round(videoDurationSec * 1000);

    // ── Step 5: Per-segment TTS + slot-based silence padding ──
    console.log("[Dubber] Generating TTS per segment...");

    interface ProcessedSegment {
      startMs: number;
      endMs: number;   // = next segment start (for SRT)
      text: string;
      audioPath: string;
      ttsDurationMs: number;
    }

    const processed: ProcessedSegment[] = [];
    const audioParts: string[] = []; // ordered list of audio files for concat

    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      const nextSeg = translatedSegments[i + 1];

      const segStartMs = Math.round(seg.start * 1000);
      // SRT end = next segment start, or video end for last segment
      const srtEndMs = nextSeg
        ? Math.round(nextSeg.start * 1000)
        : videoDurationMs;

      // Slot = how much time we have for this segment's audio
      const slotMs = srtEndMs - segStartMs;

      if (!seg.text.trim()) {
        // Empty segment — fill with silence
        if (slotMs > 0) {
          const silPath = path.join(tempDir, `sil_empty_${i}.mp3`);
          await generateSilence(slotMs, silPath);
          audioParts.push(silPath);
        }
        continue;
      }

      // Generate TTS
      let ttsResult;
      try {
        ttsResult = await generateSpeech(
          seg.text,
          options.voice as VoiceKey,
          options.speed ?? 1.0,
          options.pitch ?? 0
        );
      } catch (ttsErr) {
        console.error(`[Dubber] TTS failed for segment ${i}:`, ttsErr);
        // Fill with silence on TTS failure
        if (slotMs > 0) {
          const silPath = path.join(tempDir, `sil_fail_${i}.mp3`);
          await generateSilence(slotMs, silPath);
          audioParts.push(silPath);
        }
        continue;
      }

      // Write raw TTS audio
      const rawTtsPath = path.join(tempDir, `tts_raw_${i}.mp3`);
      await fs.writeFile(rawTtsPath, ttsResult.audioBuffer);

      // Measure actual TTS duration
      const ttsDurationMs = await getAudioDurationMs(rawTtsPath);

      let finalSegAudioPath = rawTtsPath;

      if (ttsDurationMs > slotMs && slotMs > 100) {
        // TTS longer than slot → speed up to fit
        const ratio = ttsDurationMs / slotMs;
        const clampedRatio = Math.min(ratio, 3.0); // max 3x speed up
        console.log(`[Dubber] Segment ${i}: TTS ${ttsDurationMs}ms > slot ${slotMs}ms — speeding up ${clampedRatio.toFixed(2)}x`);

        const sped = path.join(tempDir, `tts_sped_${i}.mp3`);
        await speedUpAudio(rawTtsPath, sped, clampedRatio);
        finalSegAudioPath = sped;

        // Push sped-up audio (no silence — fills entire slot)
        audioParts.push(finalSegAudioPath);
      } else {
        // TTS fits in slot → pad with silence after
        const silenceDurationMs = Math.max(0, slotMs - ttsDurationMs);

        audioParts.push(finalSegAudioPath);

        if (silenceDurationMs > 50) {
          const silPath = path.join(tempDir, `sil_${i}.mp3`);
          await generateSilence(silenceDurationMs, silPath);
          audioParts.push(silPath);
        }
      }

      processed.push({
        startMs: segStartMs,
        endMs: srtEndMs,
        text: seg.text,
        audioPath: finalSegAudioPath,
        ttsDurationMs,
      });
    }

    // ── Step 6: Concat all audio parts into final dubbed audio ──
    console.log(`[Dubber] Concatenating ${audioParts.length} audio parts...`);

    if (audioParts.length === 0) {
      throw new Error("No audio segments generated");
    }

    const listPath = path.join(tempDir, "concat_list.txt");
    const listContent = audioParts
      .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await fs.writeFile(listPath, listContent);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .on("end", () => resolve())
        .on("error", reject)
        .save(tempFinalAudio);
    });

    // ── Step 7: Build SRT content (for return value) ──
    let srtContent = "";
    processed.forEach((seg, idx) => {
      srtContent += `${idx + 1}\n`;
      srtContent += `${msToSrtTime(seg.startMs)} --> ${msToSrtTime(seg.endMs)}\n`;
      srtContent += `${seg.text}\n\n`;
    });

    // ── Step 8: Build ASS subtitle file with Myanmar font ──
    const fontPath = getMyanmarFontPath();
    const assContent = buildAssContent(
      processed.map(s => ({
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      })),
      fontPath
    );
    await fs.writeFile(tempAssPath, assContent, "utf-8");

    // ── Step 9: FFmpeg final merge — video + audio + burn ASS subtitles ──
    console.log("[Dubber] Merging video + audio + subtitles...");

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(tempVideoPath)
        .input(tempFinalAudio)
        .outputOptions([
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "28",
          "-c:a", "aac",
          "-b:a", "128k",
          "-map", "0:v",
          "-map", "1:a",
          "-shortest",
        ]);

      if (fontPath && existsSync(fontPath)) {
        // Use ASS subtitles with Myanmar font
        cmd = cmd.outputOptions([
          "-vf", `ass=${tempAssPath}:fontsdir=${path.dirname(fontPath)}`,
        ]);
        console.log(`[Dubber] Burning ASS subtitles with font: ${path.basename(fontPath)}`);
      } else {
        // No Myanmar font — burn SRT without custom font (may show boxes)
        cmd = cmd.outputOptions([
          "-vf", `subtitles=${tempAssPath}`,
        ]);
        console.warn("[Dubber] No Myanmar font found — subtitles may not render correctly!");
        console.warn("[Dubber] Run: bash backend/scripts/install-myanmar-fonts.sh");
      }

      cmd
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

    const videoUrl = `${process.env.BASE_URL || "https://choco.de5.net"}/downloads/${downloadFilename}`;

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
    console.log(`[Dubber] Downloading: ${url}`);
    await downloadVideo(url, tempVideoPath, { timeout: 300000 });

    const buffer = await fs.readFile(tempVideoPath);
    return await dubVideoFromBuffer(buffer, "video.mp4", options);

  } finally {
    await fs.unlink(tempVideoPath).catch(() => {});
  }
}