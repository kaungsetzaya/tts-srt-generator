import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
// @ts-ignore - fluent-ffmpeg doesn't have types
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import { promisify } from 'util';
import { geminiTranslate } from "./geminiTranslator";
import { generateSpeech, generateSpeechWithCharacter, type VoiceKey, type CharacterKey, CHARACTER_VOICES } from "./tts";

const execAsync = promisify(exec);

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

// ───── Whisper transcription ─────
async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string; srt: string }> {
  const outputDir = path.dirname(audioPath);
  const baseName = path.parse(audioPath).name;

  await execAsync(`whisper "${audioPath}" --model base --output_dir "${outputDir}" --output_format all`);

  const text = await fs.readFile(path.join(outputDir, `${baseName}.txt`), 'utf-8');
  const srt = await fs.readFile(path.join(outputDir, `${baseName}.srt`), 'utf-8');

  await fs.unlink(path.join(outputDir, `${baseName}.txt`)).catch(() => {});
  await fs.unlink(path.join(outputDir, `${baseName}.srt`)).catch(() => {});

  return { text, srt };
}

// ───── Build SRT content from Myanmar text ─────
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
  // ASS format: &HAABBGGRR (alpha, blue, green, red)
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

  const tempVideoPath = path.join(tempDir, `input.mp4`);
  const tempAudioExtract = path.join(tempDir, `extracted.mp3`);
  const tempTTSAudio = path.join(tempDir, `tts.mp3`);
  const tempSrtPath = path.join(tempDir, `subtitle.srt`);
  const tempOutputPath = path.join(tempDir, `output.mp4`);

  try {
    // Step 1: Write video to disk
    await fs.writeFile(tempVideoPath, videoBuffer);
    console.log(`[Dubber] Video saved: ${Math.round(videoBuffer.length / 1024)}KB`);

    // Step 2: Extract audio
    console.log(`[Dubber] Extracting audio...`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .on('end', () => resolve())
        .on('error', reject)
        .save(tempAudioExtract);
    });

    // Step 3: Whisper transcribe
    console.log(`[Dubber] Transcribing with Whisper...`);
    const { text: englishText } = await transcribeLocalWhisper(tempAudioExtract);
    if (!englishText?.trim()) throw new Error("Whisper could not detect any speech.");

    // Step 4: Gemini translate to Myanmar
    console.log(`[Dubber] Translating to Myanmar...`);
    const { myanmar: myanmarText } = await geminiTranslate(englishText);

    // Step 5: Generate TTS audio
    console.log(`[Dubber] Generating TTS (voice=${options.character || options.voice}, speed=${options.speed}, pitch=${options.pitch})...`);
    let ttsResult;
    if (options.character && options.character.trim()) {
      ttsResult = await generateSpeechWithCharacter(myanmarText, options.character as CharacterKey, options.speed, "16:9", options.pitch);
    } else {
      ttsResult = await generateSpeech(myanmarText, options.voice, options.speed, options.pitch, "16:9");
    }
    await fs.writeFile(tempTTSAudio, ttsResult.audioBuffer);

    // Step 6: Get durations
    const videoDuration = await getVideoDuration(tempVideoPath);
    const audioDuration = await getAudioDuration(tempTTSAudio);
    console.log(`[Dubber] Video duration: ${videoDuration.toFixed(1)}s, TTS duration: ${audioDuration.toFixed(1)}s`);

    // Step 7: Calculate speed adjustment
    // If durations differ, adjust video speed to match TTS audio
    const speedRatio = videoDuration / audioDuration;
    const needSpeedAdjust = Math.abs(speedRatio - 1.0) > 0.05; // only adjust if > 5% difference

    // Step 8: Build SRT file if enabled
    let srtContent = "";
    if (options.srtEnabled) {
      srtContent = buildMyanmarSRT(myanmarText, ttsResult.durationMs, 20);
      await fs.writeFile(tempSrtPath, srtContent, 'utf-8');
    }

    // Step 9: Combine everything with FFmpeg
    console.log(`[Dubber] Combining video + TTS audio${needSpeedAdjust ? ` (speed adjust: ${speedRatio.toFixed(2)}x)` : ""}${options.srtEnabled ? " + SRT" : ""}...`);
    
    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(tempVideoPath);
      
      // Add TTS audio as second input
      cmd = cmd.input(tempTTSAudio);

      // Build complex filter
      const filters: string[] = [];
      
      // Video: adjust speed if needed
      if (needSpeedAdjust) {
        // setpts=PTS/speedRatio — speed up/slow down video to match audio
        // Clamp speed ratio to reasonable bounds (0.5x - 2.0x)
        const clampedRatio = Math.max(0.5, Math.min(2.0, speedRatio));
        filters.push(`[0:v]setpts=PTS/${clampedRatio}[vspeed]`);
      }
      
      const videoLabel = needSpeedAdjust ? "[vspeed]" : "[0:v]";

      if (options.srtEnabled && existsSync(tempSrtPath)) {
        // Build ASS subtitle style
        const fontSize = options.srtFontSize || 24;
        const fontColor = hexToASS(options.srtColor || "#ffffff");
        const shadowStr = options.srtDropShadow !== false ? ",Shadow=2,BackColour=&H80000000" : ",Shadow=0";
        const borderStyle = options.srtBlurBg !== false ? ",BorderStyle=4,BackColour=&H80000000,Outline=0" : ",BorderStyle=1,Outline=2,OutlineColour=&H40000000";
        
        // Escape path for subtitles filter (Windows paths need special handling)
        const escapedSrtPath = tempSrtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        
        filters.push(`${videoLabel}subtitles='${escapedSrtPath}':force_style='FontSize=${fontSize},PrimaryColour=${fontColor},Alignment=2,MarginV=30${shadowStr}${borderStyle}'[vfinal]`);
      } else {
        if (needSpeedAdjust) {
          // Just copy the speed-adjusted video
          filters.push(`${videoLabel}copy[vfinal]`);
        }
      }

      if (filters.length > 0) {
        // Use complex filter
        cmd = cmd
          .complexFilter(filters.join(';'))
          .outputOptions([
            '-map', filters.some(f => f.includes('[vfinal]')) ? '[vfinal]' : '0:v',
            '-map', '1:a',  // use TTS audio
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-shortest',  // end when shortest stream ends
          ]);
      } else {
        // Simple case: just mute video and add TTS audio
        cmd = cmd
          .outputOptions([
            '-map', '0:v',
            '-map', '1:a',
            '-c:v', 'copy',  // no re-encode needed
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

    // Step 10: Read output and return
    const outputBuffer = await fs.readFile(tempOutputPath);
    console.log(`[Dubber] ✅ Done! Output: ${Math.round(outputBuffer.length / 1024 / 1024 * 10) / 10}MB`);

    return {
      videoBase64: outputBuffer.toString('base64'),
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
export async function dubVideoFromLink(url: string, options: DubOptions): Promise<DubResult> {
  const id = randomUUID();
  const tempVideoPath = path.join(tmpdir(), `dub_dl_${id}.mp4`);

  try {
    console.log(`[Dubber] Downloading video from: ${url}`);

    let downloadUrl = "";

    // --- Try Cobalt API first ---
    try {
      const controller = new AbortController();
      const cobaltTimeout = setTimeout(() => controller.abort(), 15000);
      const cobaltRes = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ url, downloadMode: "auto" }),
        signal: controller.signal,
      });
      clearTimeout(cobaltTimeout);
      const cobaltData = await cobaltRes.json() as any;
      if (cobaltData && (cobaltData.status === "tunnel" || cobaltData.status === "redirect") && cobaltData.url) {
        downloadUrl = cobaltData.url;
        console.log(`[Dubber] Cobalt success: ${cobaltData.status}`);
      } else if (cobaltData?.status === "picker" && cobaltData?.picker?.length > 0) {
        downloadUrl = cobaltData.picker[0]?.url || "";
      }
    } catch (e: any) {
      console.warn("[Dubber Cobalt Error]", e.name === "AbortError" ? "Timeout" : e.message?.slice(0, 200));
    }

    if (downloadUrl) {
      await execAsync(`curl -s -L --max-time 120 -o "${tempVideoPath}" "${downloadUrl}"`, { timeout: 130000 });
    } else {
      // yt-dlp fallback
      console.log("[Dubber] Using yt-dlp fallback...");
      const cookiePath = path.join(process.cwd(), 'cookies.txt');
      const hasCookies = existsSync(cookiePath);
      const cookieFlag = hasCookies ? `--cookies "${cookiePath}"` : "";
      const jsRuntime = `--js-runtimes node`;
      const commonFlags = `${jsRuntime} --no-check-certificates --no-playlist --no-warnings --geo-bypass --max-filesize 50M`;

      const strategies = [
        ...(hasCookies ? [
          `${cookieFlag} ${commonFlags} -f "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b" --merge-output-format mp4`,
          `${cookieFlag} ${commonFlags} --extractor-args "youtube:player_client=web_creator" -f "bv*+ba/b" --merge-output-format mp4`,
          `${cookieFlag} ${commonFlags} -f "b" --recode-video mp4`,
        ] : []),
        `${commonFlags} --extractor-args "youtube:player_client=web_creator" -f "b[ext=mp4]/bv*+ba/b" --merge-output-format mp4`,
        `${commonFlags} --extractor-args "youtube:player_client=android" -f "b[ext=mp4]/b" --merge-output-format mp4`,
        `${commonFlags} -f "bv*+ba/b" --merge-output-format mp4`,
        `${commonFlags} -f "worst[ext=mp4]/worst" --recode-video mp4`,
      ];

      let dlSuccess = false;
      for (let i = 0; i < strategies.length; i++) {
        await fs.unlink(tempVideoPath).catch(() => {});
        try {
          console.log(`[Dubber] yt-dlp strategy ${i + 1}/${strategies.length}...`);
          await execAsync(`yt-dlp ${strategies[i]} -o "${tempVideoPath}" "${url}"`, { timeout: 300000 });
          const stat = await fs.stat(tempVideoPath).catch(() => null);
          if (stat && stat.size > 10000) { dlSuccess = true; break; }
        } catch (e: any) {
          console.warn(`[Dubber] Strategy ${i + 1} failed: ${e.message?.slice(0, 200)}`);
        }
      }

      if (!dlSuccess) {
        throw new Error("ဗီဒီယိုကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။");
      }
    }

    // Verify file
    const fileStat = await fs.stat(tempVideoPath).catch(() => null);
    if (!fileStat || fileStat.size < 1000) {
      throw new Error("Downloaded file is empty or too small.");
    }
    console.log(`[Dubber] Video downloaded: ${Math.round(fileStat.size / 1024 / 1024 * 10) / 10}MB`);

    // Read video buffer and pass to dubVideoFromBuffer
    const videoBuffer = await fs.readFile(tempVideoPath);
    return await dubVideoFromBuffer(videoBuffer, 'downloaded.mp4', options);

  } finally {
    await fs.unlink(tempVideoPath).catch(() => {});
  }
}
