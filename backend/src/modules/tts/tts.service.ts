/**
 * TTS Service — Unified text-to-speech generation
 *
 * Supports:
 * - Tier 1: Edge-TTS Myanmar voices (Thiha, Nilar)
 * - Tier 2: Murf AI voice cloning (Character voices)
 * - Tier 3: Google Gemini 3.1 Flash TTS
 */
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import {
  ALL_VOICES,
  TIER1_VOICES,
  TIER2_VOICES,
  TIER3_VOICES,
  type VoiceId,
  type Tier1VoiceId,
  type Tier2VoiceId,
  type Tier3VoiceId,
  getVoiceCredits,
} from "./voices";
import { generateGeminiSpeechWithSRT } from "./geminiTTS.service";

const execFileAsync = promisify(execFile);

export interface GenerateResult {
  audioBuffer: Buffer;
  srtContent: string;
  rawSrt: string;
  durationMs: number;
}

const OUTPUT_DIR = process.env.EDGE_TTS_OUTPUT_DIR || path.join(process.cwd(), "output");
fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

// ─── Murf API Key Rotation ────────────────────────────────────────────────────
let currentMurfKeyIndex = 0;
export function getMurfKey(): string | undefined {
  const keysStr = process.env.MURF_API_KEY || "";
  const keys = keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  const key = keys[currentMurfKeyIndex % keys.length];
  currentMurfKeyIndex++;
  return key;
}

// ─── Tier 1: Edge-TTS Myanmar Voices ──────────────────────────────────────────
async function generateTier1Speech(
  text: string,
  voiceId: Tier1VoiceId,
  rate: number = 1.0,
  pitch: number = 0,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const voice = TIER1_VOICES[voiceId];
  if (!voice) throw new Error(`Unknown Tier 1 voice: ${voiceId}`);

  const MYANMAR_SPEED_MULTIPLIER = 1.25;
  const actualRate = rate * MYANMAR_SPEED_MULTIPLIER;
  const ratePercent = Math.round((actualRate - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const clampedPitch = Math.max(-20, Math.min(20, pitch));
  const pitchStr = clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  const id = nanoid(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.writeFile(tmpText, text, "utf8");

  if (!text.trim()) {
    throw new Error("Cannot generate speech for empty text");
  }

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  console.log(`[TTS Tier1] Generating: "${text.slice(0, 50)}..." [Voice: ${voice.edgeVoice}]`);

  try {
    await execFileAsync(pythonCmd, [
      "-m", "edge_tts",
      "--voice", voice.edgeVoice,
      `--rate=${rateStr}`,
      `--pitch=${pitchStr}`,
      "--file", tmpText,
      "--write-media", audioPath,
      "--write-subtitles", srtPath,
    ], {
      timeout: 120000,
      env: {
        ...process.env,
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

// ─── Tier 2: Murf AI Voice Cloning ─────────────────────────────────────────────
async function generateTier2Speech(
  text: string,
  voiceId: Tier2VoiceId,
  rate: number = 1.0,
  pitch: number = 0,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const char = TIER2_VOICES[voiceId];
  if (!char) throw new Error(`Unknown Tier 2 voice: ${voiceId}`);

  // Generate base speech using Tier 1 voice
  const baseResult = await generateTier1Speech(text, char.baseVoice, rate, pitch, aspectRatio);

  // Convert using Murf AI
  const murfApiKey = getMurfKey();
  if (!murfApiKey) throw new Error("MURF_API_KEY not configured");

  const { FormData, Blob } = await import("formdata-node");
  const form = new FormData();
  form.set("voice_id", char.murfId);
  form.set("format", "MP3");
  form.set("file", new Blob([baseResult.audioBuffer], { type: "audio/mpeg" }), "audio.mp3");

  console.log(`[TTS Tier2] Converting via Murf: ${char.name} (${char.murfId})`);

  const response = await fetch("https://api.murf.ai/v1/voice-changer/convert", {
    method: "POST",
    headers: { "api-key": murfApiKey },
    body: form as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Murf API Error] HTTP ${response.status}: ${errorText.slice(0, 500)}`);
    throw new Error(`Murf API returned an error (HTTP ${response.status})`);
  }

  let result: any;
  try {
    result = await response.json();
  } catch {
    const body = await response.text().catch(() => "Unknown body");
    throw new Error(`Failed to parse Murf response: ${body.slice(0, 200)}`);
  }

  if (result.error_code) {
    throw new Error(`Murf API Error: ${result.error_message} (${result.error_code})`);
  }

  const audioResponse = await fetch(result.audio_file);
  const convertedBuffer = Buffer.from(await audioResponse.arrayBuffer());

  return {
    audioBuffer: convertedBuffer,
    rawSrt: baseResult.rawSrt || "",
    srtContent: baseResult.srtContent,
    durationMs: baseResult.durationMs,
  };
}

// ─── Tier 3: Google Gemini 3.1 Flash TTS ─────────────────────────────────────
async function generateTier3Speech(
  text: string,
  voiceId: Tier3VoiceId,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const voice = TIER3_VOICES[voiceId];
  if (!voice) throw new Error(`Unknown Tier 3 voice: ${voiceId}`);

  console.log(`[TTS Tier3] Generating via Gemini: ${voice.name}`);

  const { audioBuffer, durationMs } = await generateGeminiSpeechWithSRT(text, voiceId, aspectRatio);

  return {
    audioBuffer,
    srtContent: "", // Gemini doesn't provide SRT, would need separate processing
    rawSrt: "",
    durationMs,
  };
}

// ─── Main Entry Points ─────────────────────────────────────────────────────────

/**
 * Generate speech for any voice (auto-detects tier)
 */
export async function generateSpeech(
  text: string,
  voiceId: VoiceId = "thiha",
  rate: number = 1.0,
  pitch: number = 0,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const voice = ALL_VOICES[voiceId];
  if (!voice) throw new Error(`Unknown voice: ${voiceId}`);

  switch (voice.tier) {
    case "tier1":
      return generateTier1Speech(text, voiceId as Tier1VoiceId, rate, pitch, aspectRatio);
    case "tier2":
      return generateTier2Speech(text, voiceId as Tier2VoiceId, rate, pitch, aspectRatio);
    case "tier3":
      return generateTier3Speech(text, voiceId as Tier3VoiceId, aspectRatio);
    default:
      throw new Error(`Unsupported tier: ${voice.tier}`);
  }
}

/**
 * Generate speech with character (Tier 2 Murf conversion)
 */
export async function generateSpeechWithCharacter(
  text: string,
  characterId: Tier2VoiceId,
  rate: number = 1.0,
  aspectRatio: "9:16" | "16:9" = "16:9",
  pitch: number = 0
): Promise<GenerateResult> {
  return generateTier2Speech(text, characterId, rate, pitch, aspectRatio);
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

function getProxyUrl(): string {
  const h = process.env.EDGE_TTS_PROXY_HOST;
  const p = process.env.EDGE_TTS_PROXY_PORT;
  const u = process.env.EDGE_TTS_PROXY_USER;
  const s = process.env.EDGE_TTS_PROXY_PASS;
  return h && p && u && s ? `http://${u}:${s}@${h}:${p}` : "";
}

function parseLastEndTime(srt: string): number {
  const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = [...normalized.matchAll(/\d{2}:\d{2}:\d{2},\d{3} --> (\d{2}:\d{2}:\d{2},\d{3})/g)];
  if (matches.length === 0) return 0;
  return srtTimeToMs(matches[matches.length - 1][1]);
}

function srtTimeToMs(time: string): number {
  const [hms, ms] = time.split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return (h * 3600 + m * 60 + s) * 1000 + Number(ms);
}

function msToSrtTime(ms: number): string {
  ms = Math.max(0, ms);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mil, 3)}`;
}

function pad(n: number, len = 2): string { return String(n).padStart(len, "0"); }

const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
function graphemeLen(s: string): number { return [...segmenter.segment(s)].length; }

const BURMESE_SRT_CONFIG = { "16:9": { charsPerLine: 18 }, "9:16": { charsPerLine: 12 } } as const;

function buildSRTFromRaw(rawSrt: string, originalText: string, aspectRatio: "9:16" | "16:9"): string {
  const { charsPerLine } = BURMESE_SRT_CONFIG[aspectRatio] ?? BURMESE_SRT_CONFIG["16:9"];
  const rawSegments = parseRawSrt(rawSrt);
  if (rawSegments.length === 0) return "";

  const finalSegments: { startMs: number; endMs: number; text: string }[] = [];
  let currentGroup: typeof rawSegments = [];
  let currentChars = 0;
  let currentDuration = 0;

  const MIN_DURATION_MS = 1200;
  const MAX_CHARS = charsPerLine * 2;

  for (const seg of rawSegments) {
    const glen = graphemeLen(seg.text);

    const shouldFlush =
      (currentDuration >= MIN_DURATION_MS && currentChars + glen > charsPerLine) ||
      (currentChars + glen > MAX_CHARS);

    if (shouldFlush && currentGroup.length > 0) {
      finalSegments.push({
        startMs: currentGroup[0].startMs,
        endMs: currentGroup[currentGroup.length - 1].endMs,
        text: currentGroup.map(s => s.text).join(" ").trim(),
      });
      currentGroup = [];
      currentChars = 0;
      currentDuration = 0;
    }

    currentGroup.push(seg);
    currentChars += glen;
    currentDuration = currentGroup[currentGroup.length - 1].endMs - currentGroup[0].startMs;
  }

  if (currentGroup.length > 0) {
    finalSegments.push({
      startMs: currentGroup[0].startMs,
      endMs: currentGroup[currentGroup.length - 1].endMs,
      text: currentGroup.map(s => s.text).join(" ").trim(),
    });
  }

  return finalSegments
    .filter(s => s.endMs > s.startMs)
    .map((s, idx) => {
      const start = msToSrtTime(s.startMs);
      const end = msToSrtTime(s.endMs - 20);
      return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
    })
    .join("\n");
}

function parseRawSrt(rawSrt: string): any[] {
  const normalized = rawSrt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n\n+/);
  return blocks.map(block => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) return null;
    return { startMs: srtTimeToMs(timeMatch[1]), endMs: srtTimeToMs(timeMatch[2]), text: lines.slice(2).join(" ").trim() };
  }).filter(Boolean);
}

// ─── Service Export ────────────────────────────────────────────────────────────
export const ttsService = {
  generateSpeech,
  generateSpeechWithCharacter,
  getVoiceCredits,
  ALL_VOICES,
  TIER1_VOICES,
  TIER2_VOICES,
  TIER3_VOICES,
};
