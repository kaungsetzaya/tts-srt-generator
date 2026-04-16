import { promises as fs } from "fs";
import { existsSync } from "fs";
import * as path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
// @ts-ignore - fluent-ffmpeg doesn't have types
import ffmpeg from "fluent-ffmpeg";
import { execFile } from "child_process";
import { promisify } from "util";
import { geminiTranslate } from "./geminiTranslator";
import {
  generateSpeech,
  generateSpeechWithCharacter,
  type VoiceKey,
  type CharacterKey,
  CHARACTER_VOICES,
} from "./tts";
import {
  isAllowedVideoUrl,
  isPathWithinDir,
  sanitizeForAI,
} from "./_core/security";

const execFileAsync = promisify(execFile);

// ───── Types ─────
export interface DubOptions {
  voice: VoiceKey;
  character?: string;
  speed: number;
  pitch: number;
  srtEnabled: boolean;
  srtFontSize?: number;
  srtColor?: string;
  srtDropShadow?: boolean;
  srtBlurBg?: boolean;
  srtMarginV?: number;
  srtBlurSize?: number;
  srtBlurColor?: "black" | "white";
  srtFullWidth?: boolean;
  srtBorderRadius?: "rounded" | "square";
}

export interface DubResult {
  videoBase64: string;
  myanmarText: string;
  srtContent: string;
  durationMs: number;
}

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

// ───── Whisper transcription — uses execFile with argument array ─────
async function transcribeLocalWhisper(
  audioPath: string
): Promise<{ text: string; srt: string }> {
  const outputDir = path.dirname(audioPath);
  const baseName = path.parse(audioPath).name;

  // 🔐 FFmpeg Command Guard: execFile with argument array prevents command injection
  await execFileAsync("whisper", [
    audioPath,
    "--model",
    "base",
    "--output_dir",
    outputDir,
    "--output_format",
    "all",
  ]);

  const textPath = path.join(outputDir, `${baseName}.txt`);
  const srtPath = path.join(outputDir, `${baseName}.srt`);

  // 🔐 Path traversal check
  if (
    !isPathWithinDir(textPath, outputDir) ||
    !isPathWithinDir(srtPath, outputDir)
  ) {
    throw new Error("Invalid file path detected.");
  }

  const text = await fs.readFile(textPath, "utf-8");
  const srt = await fs.readFile(srtPath, "utf-8");

  await fs.unlink(textPath).catch(() => {});
  await fs.unlink(srtPath).catch(() => {});

  return { text, srt };
}

// ───── Build SRT content from Myanmar text ─────
function buildMyanmarSRT(
  text: string,
  durationMs: number,
  charsPerLine: number = 20
): string {
  const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
  function graphemeLen(s: string): number {
    return Array.from(segmenter.segment(s)).length;
  }

  function msToSrtTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(mil).padStart(3, "0")}`;
  }

  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0);
  if (tokens.length === 0) return "";

  const segments: string[][] = [];
  let cur: string[] = [];
  for (const token of tokens) {
    cur.push(token);
    if (/[၊။]$/.test(token)) {
      segments.push(cur);
      cur = [];
    }
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
        current = [];
        currentChars = 0;
      }
      current.push(token);
      currentChars += (currentChars > 0 ? 1 : 0) + tokenChars;
    }
    if (current.length > 0) lines.push(current.join(" "));
  }

  const blocks: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (i + 1 < lines.length) {
      blocks.push([lines[i], lines[i + 1]]);
      i += 2;
    } else {
      blocks.push([lines[i]]);
      i++;
    }
  }

  const blockWordCounts = blocks.map(
    b =>
      b
        .join(" ")
        .split(/\s+/)
        .filter(t => t.length > 0).length
  );
  const totalBlockWords = blockWordCounts.reduce((a, b) => a + b, 0);

  const result: string[] = [];
  let currentMs = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const blockDuration = Math.round(
      (blockWordCounts[idx] / totalBlockWords) * durationMs
    );
    const startMs = currentMs;
    const endMs =
      idx === blocks.length - 1 ? durationMs : currentMs + blockDuration;
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
  // ASS format: &HAABBGGRR (alpha, blue, green, red)
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}`.toUpperCase();
}

// ───── MAIN: Dub video from buffer ─────
export async function dubVideoFromBuffer(
  videoBuffer: Buffer,
  filename: string,
  options: DubOptions
): Promise<DubResult> {
  // 🔐 UUID Filenames: never use original filename
  const id = randomUUID();
  const tempDir = path.join(tmpdir(), `dub_${id}`);
  await fs.mkdir(tempDir, { recursive: true });

  // 🔐 Path traversal check
  if (!isPathWithinDir(tempDir, tmpdir())) {
    throw new Error("Invalid temp directory.");
  }

  const tempVideoPath = path.join(tempDir, `input_${id}.mp4`);
  const tempAudioExtract = path.join(tempDir, `extracted_${id}.mp3`);
  const tempTTSAudio = path.join(tempDir, `tts_${id}.mp3`);
  const tempSrtPath = path.join(tempDir, `subtitle_${id}.srt`);
  const tempOutputPath = path.join(tempDir, `output_${id}.mp4`);

  try {
    // Step 1: Write video to disk
    await fs.writeFile(tempVideoPath, videoBuffer);
    console.log(
      `[Dubber] Video saved: ${Math.round(videoBuffer.length / 1024)}KB`
    );

    // Step 2: Extract audio
    console.log(`[Dubber] Extracting audio...`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .on("end", () => resolve())
        .on("error", reject)
        .save(tempAudioExtract);
    });

    // Step 3: Whisper transcribe
    console.log(`[Dubber] Transcribing with Whisper...`);
    const { text: englishText } =
      await transcribeLocalWhisper(tempAudioExtract);
    if (!englishText?.trim())
      throw new Error("Whisper could not detect any speech.");

    // Step 4: Gemini translate to Myanmar (with prompt injection guard)
    console.log(`[Dubber] Translating to Myanmar...`);
    const sanitizedText = sanitizeForAI(englishText);
    const { myanmar: myanmarText } = await geminiTranslate(sanitizedText);

    // Step 5: Generate TTS audio
    console.log(
      `[Dubber] Generating TTS (voice=${options.character || options.voice}, speed=${options.speed}, pitch=${options.pitch})...`
    );
    let ttsResult;
    if (options.character && options.character.trim()) {
      ttsResult = await generateSpeechWithCharacter(
        myanmarText,
        options.character as CharacterKey,
        options.speed,
        "16:9",
        options.pitch
      );
    } else {
      ttsResult = await generateSpeech(
        myanmarText,
        options.voice,
        options.speed,
        options.pitch,
        "16:9"
      );
    }
    await fs.writeFile(tempTTSAudio, ttsResult.audioBuffer);

    // Step 6: Get durations
    const videoDuration = await getVideoDuration(tempVideoPath);
    const audioDuration = await getAudioDuration(tempTTSAudio);
    console.log(
      `[Dubber] Video duration: ${videoDuration.toFixed(1)}s, TTS duration: ${audioDuration.toFixed(1)}s`
    );

    // Step 7: Calculate speed adjustment
    const speedRatio = videoDuration / audioDuration;
    const needSpeedAdjust = Math.abs(speedRatio - 1.0) > 0.05;

    // Step 8: Build SRT file if enabled
    let srtContent = "";
    if (options.srtEnabled) {
      srtContent = buildMyanmarSRT(myanmarText, ttsResult.durationMs, 20);
      // 🔤 Write SRT with UTF-8 BOM for Myanmar character encoding
      const BOM = "\uFEFF";
      await fs.writeFile(tempSrtPath, BOM + srtContent, "utf-8");
    }

    // Step 9: Combine everything with FFmpeg
    console.log(
      `[Dubber] Combining video + TTS audio${needSpeedAdjust ? ` (speed adjust: ${speedRatio.toFixed(2)}x)` : ""}${options.srtEnabled ? " + SRT" : ""}...`
    );

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(tempVideoPath);

      // Add TTS audio as second input
      cmd = cmd.input(tempTTSAudio);

      // Build complex filter
      const filters: string[] = [];

      // Video: adjust speed if needed
      if (needSpeedAdjust) {
        const clampedRatio = Math.max(0.5, Math.min(2.0, speedRatio));
        filters.push(`[0:v]setpts=PTS/${clampedRatio}[vspeed]`);
      }

      const videoLabel = needSpeedAdjust ? "[vspeed]" : "[0:v]";

      if (options.srtEnabled && existsSync(tempSrtPath)) {
        const fontSize = options.srtFontSize || 28;
        const fontColor = hexToASS(options.srtColor || "#ffffff");
        const marginV = options.srtMarginV ?? 40;
        const shadowStr =
          options.srtDropShadow !== false
            ? ",Shadow=2,BackColour=&H80000000"
            : ",Shadow=0";

        const blurColor =
          options.srtBlurColor === "white" ? "FFFFFF" : "000000";
        const blurAlpha =
          options.srtBlurBg !== false
            ? Math.min(
                255,
                Math.max(0, Math.round((options.srtBlurSize ?? 8) * 16))
              )
                .toString(16)
                .toUpperCase()
                .padStart(2, "0")
            : "FF";
        const borderStyle =
          options.srtBlurBg !== false
            ? `,BorderStyle=4,BackColour=&H${blurAlpha}${blurColor},Outline=0`
            : ",BorderStyle=1,Outline=2,OutlineColour=&H40000000";

        const marginLR = options.srtFullWidth ? ",MarginL=20,MarginR=20" : "";

        const escapedSrtPath = tempSrtPath
          .replace(/\\/g, "/")
          .replace(/:/g, "\\:");

        // 🔤 Myanmar Font Fix: use multiple font fallbacks with proper Myanmar Unicode support
        // Noto Sans Myanmar > Padauk > Myanmar3 > Pyidaungsu
        const myanmarFont =
          "Fontname='Noto Sans Myanmar',Fontname='Padauk',Fontname='Myanmar3',Fontname='Pyidaungsu'";
        const encoding = ",Encoding=1"; // UTF-8 encoding for ASS
        const boldStyle = ",Bold=1";
        const spacing = ",Spacing=1";

        filters.push(
          `${videoLabel}subtitles='${escapedSrtPath}':force_style='${myanmarFont},FontSize=${fontSize},PrimaryColour=${fontColor},Alignment=2,MarginV=${marginV}${marginLR}${shadowStr}${borderStyle}${encoding}${boldStyle}${spacing}'[vfinal]`
        );
      } else {
        if (needSpeedAdjust) {
          filters.push(`${videoLabel}copy[vfinal]`);
        }
      }

      if (filters.length > 0) {
        cmd = cmd
          .complexFilter(filters.join(";"))
          .outputOptions([
            "-map",
            filters.some(f => f.includes("[vfinal]")) ? "[vfinal]" : "0:v",
            "-map",
            "1:a",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-shortest",
          ]);
      } else {
        cmd = cmd.outputOptions([
          "-map",
          "0:v",
          "-map",
          "1:a",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          "-shortest",
        ]);
      }

      cmd
        .on("start", (cmdline: string) =>
          console.log(`[Dubber] FFmpeg cmd:`, cmdline.slice(0, 200))
        )
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(tempOutputPath);
    });

    // Step 10: Read output and return
    const outputBuffer = await fs.readFile(tempOutputPath);
    console.log(
      `[Dubber] ✅ Done! Output: ${Math.round((outputBuffer.length / 1024 / 1024) * 10) / 10}MB`
    );

    return {
      videoBase64: outputBuffer.toString("base64"),
      myanmarText,
      srtContent,
      durationMs: ttsResult.durationMs,
    };
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ───── MAIN: Dub video from URL ─────
export async function dubVideoFromLink(
  url: string,
  options: DubOptions
): Promise<DubResult> {
  // 🔐 yt-dlp Domain Whitelist
  if (!isAllowedVideoUrl(url)) {
    throw new Error(
      "ခွင့်ပြုထားသော Link များသာ သုံးနိုင်ပါသည်။ YouTube, TikTok, Facebook Link သာ ထည့်ပါ။"
    );
  }

  const id = randomUUID();
  const tempVideoPath = path.join(tmpdir(), `dub_dl_${id}.mp4`);

  // 🔐 Path traversal check
  if (!isPathWithinDir(tempVideoPath, tmpdir())) {
    throw new Error("Invalid temp directory.");
  }

  try {
    console.log(`[Dubber] Downloading video from: ${url}`);

    let downloadUrl = "";

    // --- Try Cobalt API first ---
    try {
      const controller = new AbortController();
      const cobaltTimeout = setTimeout(() => controller.abort(), 20000);
      const cobaltRes = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; CobaltClient/1.0)",
        },
        body: JSON.stringify({
          url,
          downloadMode: "auto",
          videoQuality: "720",
          audioFormat: "mp3",
        }),
        signal: controller.signal,
      });
      clearTimeout(cobaltTimeout);
      if (cobaltRes.ok) {
        const cobaltData = (await cobaltRes.json()) as any;
        if (
          cobaltData &&
          (cobaltData.status === "tunnel" ||
            cobaltData.status === "redirect") &&
          cobaltData.url
        ) {
          downloadUrl = cobaltData.url;
          console.log(`[Dubber] Cobalt success: ${cobaltData.status}`);
        } else if (
          cobaltData?.status === "picker" &&
          cobaltData?.picker?.length > 0
        ) {
          downloadUrl = cobaltData.picker[0]?.url || "";
        } else {
          console.warn(
            `[Dubber] Cobalt returned:`,
            JSON.stringify(cobaltData).slice(0, 200)
          );
        }
      } else {
        console.warn(`[Dubber] Cobalt API HTTP ${cobaltRes.status}`);
      }
    } catch (e: any) {
      console.warn(
        "[Dubber Cobalt Error]",
        e.name === "AbortError" ? "Timeout" : e.message?.slice(0, 200)
      );
    }

    if (downloadUrl) {
      // 🔐 FFmpeg Command Guard: use execFile with argument array
      await execFileAsync(
        "curl",
        ["-s", "-L", "--max-time", "120", "-o", tempVideoPath, downloadUrl],
        { timeout: 130000 }
      );
    } else {
      // yt-dlp fallback — 🔐 uses execFile with argument array
      console.log("[Dubber] Using yt-dlp fallback...");
      const cookiePath = path.join(process.cwd(), "cookies.txt");
      const hasCookies = existsSync(cookiePath);

      const baseArgs = [
        "--no-check-certificates",
        "--no-playlist",
        "--no-warnings",
        "--geo-bypass",
        "--max-filesize",
        "50M",
      ];

      const strategies: string[][] = [
        ...(hasCookies
          ? [
              [
                ...baseArgs,
                "--cookies",
                cookiePath,
                "--extractor-args",
                "youtube:player_client=tv",
                "-f",
                "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b",
                "--merge-output-format",
                "mp4",
              ],
              [
                ...baseArgs,
                "--cookies",
                cookiePath,
                "--extractor-args",
                "youtube:player_client=web_creator",
                "-f",
                "bv*+ba/b",
                "--merge-output-format",
                "mp4",
              ],
              [
                ...baseArgs,
                "--cookies",
                cookiePath,
                "-f",
                "b",
                "--recode-video",
                "mp4",
              ],
            ]
          : []),
        // tv client — most reliable without cookies
        [
          ...baseArgs,
          "--extractor-args",
          "youtube:player_client=tv",
          "-f",
          "b[ext=mp4]/bv*+ba/b",
          "--merge-output-format",
          "mp4",
        ],
        // mweb client
        [
          ...baseArgs,
          "--extractor-args",
          "youtube:player_client=mweb",
          "-f",
          "b[ext=mp4]/bv*+ba/b",
          "--merge-output-format",
          "mp4",
        ],
        // android client
        [
          ...baseArgs,
          "--extractor-args",
          "youtube:player_client=android",
          "-f",
          "b[ext=mp4]/b",
          "--merge-output-format",
          "mp4",
        ],
        // web_creator client
        [
          ...baseArgs,
          "--extractor-args",
          "youtube:player_client=web_creator",
          "-f",
          "b[ext=mp4]/bv*+ba/b",
          "--merge-output-format",
          "mp4",
        ],
        // generic fallback
        [...baseArgs, "-f", "bv*+ba/b", "--merge-output-format", "mp4"],
        [...baseArgs, "-f", "worst[ext=mp4]/worst", "--recode-video", "mp4"],
      ];

      let dlSuccess = false;
      for (let i = 0; i < strategies.length; i++) {
        await fs.unlink(tempVideoPath).catch(() => {});
        try {
          console.log(
            `[Dubber] yt-dlp strategy ${i + 1}/${strategies.length}...`
          );
          // 🔐 FFmpeg Command Guard: execFile prevents injection
          await execFileAsync(
            "yt-dlp",
            [...strategies[i], "-o", tempVideoPath, url],
            { timeout: 300000 }
          );
          const stat = await fs.stat(tempVideoPath).catch(() => null);
          if (stat && stat.size > 10000) {
            dlSuccess = true;
            break;
          }
        } catch (e: any) {
          console.warn(
            `[Dubber] Strategy ${i + 1} failed: ${e.message?.slice(0, 200)}`
          );
        }
      }

      if (!dlSuccess) {
        throw new Error(
          "ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။"
        );
      }
    }

    // Verify file
    const fileStat = await fs.stat(tempVideoPath).catch(() => null);
    if (!fileStat || fileStat.size < 1000) {
      throw new Error("Downloaded file is empty or too small.");
    }
    console.log(
      `[Dubber] Video downloaded: ${Math.round((fileStat.size / 1024 / 1024) * 10) / 10}MB`
    );

    // Read video buffer and pass to dubVideoFromBuffer
    const videoBuffer = await fs.readFile(tempVideoPath);
    return await dubVideoFromBuffer(
      videoBuffer,
      `downloaded_${id}.mp4`,
      options
    );
  } finally {
    await fs.unlink(tempVideoPath).catch(() => {});
  }
}
