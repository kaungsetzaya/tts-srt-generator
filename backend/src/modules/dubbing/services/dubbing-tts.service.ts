/**
 * Dubbing TTS Service — Dedicated TTS for video dubbing
 * Separated from shared tts.services per architecture requirements
 * Uses edge-tts for base voices + Murf AI for character voices
 */
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import {
  parseLastEndTime,
  srtTimeToMs,
  msToSrtTime,
  pad,
  graphemeLen,
  getGraphemes,
  parseRawSrt,
  formatSrtText,
  BURMESE_SRT_CONFIG,
  type RawSrtSegment,
} from "../../_core/srt.utils";

const execFileAsync = promisify(execFile);

export const SUPPORTED_VOICES = {
  thiha: { name: "Thiha", shortName: "my-MM-ThihaNeural" },
  nilar: { name: "Nilar", shortName: "my-MM-NilarNeural" },
};

export type VoiceKey = keyof typeof SUPPORTED_VOICES;

export const CHARACTER_VOICES = {
  ryan: { name: "ရိုင်ယန်", gender: "male", murfId: "en-US-ryan", base: "thiha" as const },
  ronnie: { name: "ရော်နီ", gender: "male", murfId: "en-US-ronnie", base: "thiha" as const },
  lucas: { name: "လူးကാസ်", gender: "male", murfId: "en-US-lucas", base: "thiha" as const },
  daniel: { name: "ဒမိယယ်", gender: "male", murfId: "en-US-daniel", base: "thiha" as const },
  evander: { name: "အီဗန်ဒာ", gender: "male", murfId: "en-US-evander", base: "thiha" as const },
  michelle: { name: "မိချယ်", gender: "female", murfId: "en-US-michelle", base: "nilar" as const },
  iris: { name: "အိုင်ရစ်", gender: "female", murfId: "en-US-iris", base: "nilar" as const },
  charlotte: { name: "ချာလတ်", gender: "female", murfId: "en-US-charlotte", base: "nilar" as const },
  amara: { name: "အမာရ", gender: "female", murfId: "en-US-amara", base: "nilar" as const },
};

export type CharacterKey = keyof typeof CHARACTER_VOICES;

export interface GenerateResult {
  audioBuffer: Buffer;
  srtContent: string;
  rawSrt: string;
  durationMs: number;
}

const OUTPUT_DIR = process.env.EDGE_TTS_OUTPUT_DIR || path.join(process.cwd(), "output");
fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

let currentMurfKeyIndex = 0;
export function getMurfKey(): string | undefined {
  const keysStr = process.env.MURF_API_KEY || "";
  const keys = keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  const key = keys[currentMurfKeyIndex % keys.length];
  currentMurfKeyIndex++;
  return key;
}

/**
 * Generate speech using edge-tts for dubbing.
 */
export async function generateSpeech(
  text: string,
  voice: VoiceKey = "thiha",
  rate: number = 1.0,
  pitch: number = 0,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const voiceConfig = SUPPORTED_VOICES[voice];
  if (!voiceConfig) throw new Error(`Unsupported voice: ${voice}`);

  const MYANMAR_SPEED_MULTIPLIER = 1.0;
  const actualRate = rate * MYANMAR_SPEED_MULTIPLIER;
  const ratePercent = Math.round((actualRate - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const clampedPitch = Math.max(-20, Math.min(20, pitch));
  const pitchStr = clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  if (!text.trim()) {
    console.error(`[DubbingTTS] Attempted to generate speech for empty text (Voice: ${voice})`);
    throw new Error("Cannot generate speech for empty text");
  }

  const id = nanoid(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  const processedText = text
    .replace(/၊/g, ', ')
    .replace(/။/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  await fs.writeFile(tmpText, processedText, "utf8");

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  console.log(`[DubbingTTS] Generating: "${text.slice(0, 50)}..." [Voice: ${voiceConfig.shortName}, Rate: ${rateStr}]`);

  try {
    await execFileAsync(pythonCmd, [
      "-m", "edge_tts",
      "--voice", voiceConfig.shortName,
      `--rate=${rateStr}`,
      `--pitch=${pitchStr}`,
      "--file", tmpText,
      "--write-media", audioPath,
      "--write-subtitles", srtPath,
    ], {
      timeout: 120000,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        HTTPS_PROXY: getProxyUrl(),
        HTTP_PROXY: getProxyUrl(),
      },
    });

    const audioBuffer = await fs.readFile(audioPath);
    const rawSrt = await fs.readFile(srtPath, "utf8").catch(() => "");
    const durationMs = parseLastEndTime(rawSrt);
    const srtContent = buildSRTFromRaw(rawSrt, text, aspectRatio);

    return { audioBuffer, rawSrt, srtContent, durationMs };
  } finally {
    await fs.unlink(tmpText).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
  }
}

/**
 * Generate speech with character voice (Murf AI conversion)
 */
export async function generateSpeechWithCharacter(
  text: string,
  characterKey: CharacterKey,
  rate: number = 1.0,
  aspectRatio: "9:16" | "16:9" = "16:9",
  pitch: number = 0
): Promise<GenerateResult> {
  const char = CHARACTER_VOICES[characterKey];
  const baseResult = await generateSpeech(text, char.base, rate, pitch, aspectRatio);
  
  const murfApiKey = getMurfKey();
  if (!murfApiKey) throw new Error("MURF_API_KEY not configured");

  const form = new FormData();
  form.set("voice_id", char.murfId);
  form.set("format", "MP3");
  form.set("file", new Blob([new Uint8Array(baseResult.audioBuffer)], { type: "audio/mpeg" }), "audio.mp3");

  const response = await fetch("https://api.murf.ai/v1/voice-changer/convert", {
    method: "POST",
    headers: { "api-key": murfApiKey },
    body: form as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Murf API Error] HTTP ${response.status}: ${errorText.slice(0, 500)}`);
    throw new Error(`Murf API returned an error (HTTP ${response.status}). The service might be temporarily unavailable.`);
  }

  let result: any;
  try {
    result = await response.json();
  } catch (err) {
    const body = await response.text().catch(() => "Unknown body");
    console.error(`[DubbingTTS] Failed to parse Murf response as JSON. Body start: ${body.slice(0, 200)}`);
    throw new Error("Failed to parse TTS conversion response. The API might be down or returning an error page.");
  }

  if (result.error_code) {
    throw new Error(`[Murf API Error] ${result.error_message} (${result.error_code})`);
  }

  // Validate Murf audio URL to prevent SSRF
  const audioUrl = result.audio_file;
  if (!audioUrl || !audioUrl.startsWith("https://")) {
    throw new Error("Murf returned an invalid audio URL");
  }
  const audioResponse = await fetch(audioUrl);
  const convertedBuffer = Buffer.from(await audioResponse.arrayBuffer());

  return {
    audioBuffer: convertedBuffer,
    rawSrt: baseResult.rawSrt || "",
    srtContent: baseResult.srtContent,
    durationMs: baseResult.durationMs,
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getProxyUrl(): string {
  const h = process.env.EDGE_TTS_PROXY_HOST;
  const p = process.env.EDGE_TTS_PROXY_PORT;
  const u = process.env.EDGE_TTS_PROXY_USER;
  const s = process.env.EDGE_TTS_PROXY_PASS;
  return h && p && u && s ? `http://${u}:${s}@${h}:${p}` : "";
}

function buildSRTFromRaw(rawSrt: string, originalText: string, aspectRatio: "9:16" | "16:9"): string {
  const { charsPerLine } = BURMESE_SRT_CONFIG[aspectRatio] ?? BURMESE_SRT_CONFIG["16:9"];
  const rawSegments = parseRawSrt(rawSrt);
  if (rawSegments.length === 0) return "";

  const finalSegments: { startMs: number; endMs: number; text: string }[] = [];
  let currentGroup: RawSrtSegment[] = [];
  let currentChars = 0;
  const MAX_CHARS_PER_BLOCK = charsPerLine * 2;

  for (const seg of rawSegments) {
    const glen = graphemeLen(seg.text);

    if (glen > MAX_CHARS_PER_BLOCK) {
      if (currentGroup.length > 0) {
        finalSegments.push({
          startMs: currentGroup[0].startMs,
          endMs: currentGroup[currentGroup.length - 1].endMs,
          text: formatSrtText(currentGroup.map(s => s.text).join(" ").trim(), charsPerLine)
        });
        currentGroup = [];
        currentChars = 0;
      }

      const graphemes = getGraphemes(seg.text);
      const totalDuration = seg.endMs - seg.startMs;
      const charsPerBlock = MAX_CHARS_PER_BLOCK;
      let charOffset = 0;
      let blockStartMs = seg.startMs;

      while (charOffset < graphemes.length) {
        const chunkGraphemes = graphemes.slice(charOffset, charOffset + charsPerBlock);
        const chunkText = chunkGraphemes.join("").trim();
        const chunkChars = chunkGraphemes.length;
        const chunkDuration = Math.round((chunkChars / graphemes.length) * totalDuration);
        const chunkEndMs = charOffset + charsPerBlock >= graphemes.length
          ? seg.endMs
          : blockStartMs + chunkDuration;

        finalSegments.push({
          startMs: blockStartMs,
          endMs: chunkEndMs,
          text: formatSrtText(chunkText, charsPerLine)
        });

        charOffset += charsPerBlock;
        blockStartMs = chunkEndMs;
      }
      continue;
    }

    if (currentChars + glen > MAX_CHARS_PER_BLOCK && currentGroup.length > 0) {
      finalSegments.push({
        startMs: currentGroup[0].startMs,
        endMs: currentGroup[currentGroup.length - 1].endMs,
        text: formatSrtText(currentGroup.map(s => s.text).join(" ").trim(), charsPerLine)
      });
      currentGroup = [];
      currentChars = 0;
    }

    currentGroup.push(seg);
    currentChars += glen;
  }

  if (currentGroup.length > 0) {
    finalSegments.push({
      startMs: currentGroup[0].startMs,
      endMs: currentGroup[currentGroup.length - 1].endMs,
      text: formatSrtText(currentGroup.map(s => s.text).join(" ").trim(), charsPerLine)
    });
  }

  return finalSegments
    .filter(s => s.endMs > s.startMs && s.text.trim())
    .map((s, idx) => {
      const start = msToSrtTime(s.startMs);
      const end = msToSrtTime(s.endMs - 10);
      return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
    })
    .join("\n");
}

export const dubbingTtsService = {
  SUPPORTED_VOICES,
  CHARACTER_VOICES,
  generateSpeech,
  generateSpeechWithCharacter,
};
