/**
 * TTS Service Ã¢â‚¬â€ Unified text-to-speech generation
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
import { ffmpegService } from "../media/services/ffmpeg.service";
import ffmpeg from "fluent-ffmpeg";

const execFileAsync = promisify(execFile);

export interface GenerateResult {
  audioBuffer: Buffer;
  srtContent: string;
  rawSrt: string;
  durationMs: number;
}

const OUTPUT_DIR = process.env.EDGE_TTS_OUTPUT_DIR || path.join(process.cwd(), "output");
fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Murf API Key Rotation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let currentMurfKeyIndex = 0;
export function getMurfKey(): string | undefined {
  const keysStr = process.env.MURF_API_KEY || "";
  const keys = keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  const key = keys[currentMurfKeyIndex % keys.length];
  currentMurfKeyIndex++;
  return key;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Tier 1: Edge-TTS Myanmar Voices Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function generateTier1Speech(
  text: string,
  voiceId: Tier1VoiceId,
  rate: number = 1.0,
  pitch: number = 0,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const voice = TIER1_VOICES[voiceId];
  if (!voice) throw new Error(`Unknown Tier 1 voice: ${voiceId}`);

  const MYANMAR_SPEED_MULTIPLIER = 1.1;
  const adjustedRate = rate * MYANMAR_SPEED_MULTIPLIER;
  const rateStr = adjustedRate >= 1.0 ? `+${Math.round((adjustedRate-1)*100)}%` : `-${Math.round((1-adjustedRate)*100)}%`;
  const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const baseId = nanoid(10);
  const tempDir = path.join(OUTPUT_DIR, `tts_${baseId}`);
  await fs.mkdir(tempDir, { recursive: true });

  const MAX_CHARS_PER_REQUEST = 2000;

  // Split by sentence-ending punctuation first, filter empty
  let sentences = text.split(/(?<=[။])/u).map(s => s.trim()).filter(s => s && s.length > 0);

  // If any sentence exceeds limit, further split by characters
  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length > MAX_CHARS_PER_REQUEST) {
      for (let i = 0; i < sentence.length; i += MAX_CHARS_PER_REQUEST) {
        chunks.push(sentence.slice(i, i + MAX_CHARS_PER_REQUEST));
      }
    } else {
      chunks.push(sentence);
    }
  }

  const audioParts: string[] = [];
  const segments: { text: string; startMs: number; endMs: number }[] = [];
  let currentMs = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkMp3 = path.join(tempDir, `chunk_${i}.mp3`);
    const chunkTrimmedWav = path.join(tempDir, `chunk_${i}_trimmed.wav`);

    // Generate TTS with proxy
    const proxyArg = getProxyUrl();
    const ttsArgs = [
      "-m", "edge_tts",
      "--voice", voice.edgeVoice,
      `--rate=${rateStr}`,
      `--pitch=${pitchStr}`,
      "--text", chunk,
      "--write-media", chunkMp3,
    ];
    if (proxyArg) {
      // Insert --proxy after "-m", "edge_tts" so it reaches edge_tts, not python
      const insertIdx = ttsArgs.indexOf("-m") + 2; // after "-m", "edge_tts"
      ttsArgs.splice(insertIdx, 0, "--proxy", proxyArg);
    }

    // Retry once on failure
    let success = false;
    for (let retry = 0; retry < 2 && !success; retry++) {
      try {
        await execFileAsync(pythonCmd, ttsArgs, { timeout: 60000 });
        success = true;
      } catch (err) {
        if (retry === 0) {
          console.warn(`[TTS] Chunk ${i} failed, retrying...`);
          await new Promise(r => setTimeout(r, 100));
        } else {
          throw err;
        }
      }
    }

    // Convert to WAV: trim silence from both ends
    await new Promise<void>((resolve, reject) => {
      const trimFilter = "silenceremove=start_periods=1:start_duration=0:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-40dB,areverse";
      (ffmpeg as any)(chunkMp3)
        .audioFilters(trimFilter)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(1)
        .on('end', () => resolve())
        .on('error', reject)
        .save(chunkTrimmedWav);
    });

    const chunkDurationMs = await ffmpegService.getAudioDurationMs(chunkTrimmedWav);

    audioParts.push(chunkTrimmedWav);
    segments.push({ text: chunk, startMs: currentMs, endMs: currentMs + chunkDurationMs });
    currentMs += chunkDurationMs + 250; // +250ms gap for natural pause

    // 100ms delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }

    await fs.unlink(chunkMp3).catch(() => {});
  }

  // Merge all parts: concat with silence gaps
  const finalMp3 = path.join(tempDir, `final_${baseId}.mp3`);
  const silenceWav = path.join(tempDir, `silence_250ms.wav`);

  // Generate 250ms silence WAV
  await new Promise<void>((resolve, reject) => {
    (ffmpeg as any)()
      .input('anullsrc=r=44100:cl=mono')
      .inputOptions(['-f', 'lavfi', '-t', '0.25'])
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .audioChannels(1)
      .on('end', () => resolve())
      .on('error', reject)
      .save(silenceWav);
  });

  // Build merged list: audio, silence, audio, silence, audio
  const mergedParts: string[] = [];
  audioParts.forEach((p, idx) => {
    mergedParts.push(p);
    if (idx < audioParts.length - 1) {
      mergedParts.push(silenceWav);
    }
  });

  // Create concat file list
  const concatEntries = mergedParts.map(p => `file '${p}'`).join('\n');
  const concatListPath = path.join(tempDir, 'concat_list.txt');
  await fs.writeFile(concatListPath, concatEntries);

  // Step 1: Concat merge to intermediate WAV
  const mergedWav = path.join(tempDir, `merged_${baseId}.wav`);
  await new Promise<void>((resolve, reject) => {
    (ffmpeg as any)(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .audioChannels(1)
      .on('end', () => resolve())
      .on('error', reject)
      .save(mergedWav);
  });

  // Step 2: Apply enhancement to merged audio
  const enhancedWav = path.join(tempDir, `enhanced_${baseId}.wav`);
  await new Promise<void>((resolve, reject) => {
    const filters = [
      "dynaudnorm=g=5:f=150",
      "equalizer=f=1000:w=2000:g=3",
      "equalizer=f=3000:w=2000:g=2",
    ].join(',');
    (ffmpeg as any)(mergedWav)
      .audioFilters(filters)
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .audioChannels(1)
      .on('end', () => resolve())
      .on('error', reject)
      .save(enhancedWav);
  });

  // Step 3: Encode to final MP3
  await new Promise<void>((resolve, reject) => {
    (ffmpeg as any)(enhancedWav)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .on('end', () => resolve())
      .on('error', reject)
      .save(finalMp3);
  });

  const audioBuffer = await fs.readFile(finalMp3);

  // Build SRT from actual segment timings
  const srtContent = segments.map((s, idx) => {
    const start = msToSrtTime(s.startMs);
    const end = msToSrtTime(s.endMs);
    return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
  }).join("\n");

  // Cleanup temp dir
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

  return { audioBuffer, rawSrt: srtContent, srtContent, durationMs: currentMs };
}

// Ã¢Å"â‚¬Ã¢Å"â‚¬Ã¢Å"â‚¬ Tier 2: Murf AI Voice Cloning Ã¢Å"â‚¬Ã¢Å"â‚¬Ã¢Å"â‚¬
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

  const form = new FormData();
  form.set("voice_id", char.murfId);
  form.set("format", "MP3");
  form.set("file", new Blob([new Uint8Array(baseResult.audioBuffer)], { type: "audio/mpeg" }), "audio.mp3");

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Tier 3: Google Gemini 3.1 Flash TTS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Main Entry Points Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helper Functions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

  const MAX_CHARS = charsPerLine * 2;

  for (const seg of rawSegments) {
    const glen = graphemeLen(seg.text);

    const shouldFlush = currentChars + glen > MAX_CHARS;

    if (shouldFlush && currentGroup.length > 0) {
      finalSegments.push({
        startMs: currentGroup[0].startMs,
        endMs: currentGroup[currentGroup.length - 1].endMs,
        text: currentGroup.map(s => s.text).join(" ").trim(),
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Service Export Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const ttsService = {
  generateSpeech,
  generateSpeechWithCharacter,
  getVoiceCredits,
  ALL_VOICES,
  TIER1_VOICES,
  TIER2_VOICES,
  TIER3_VOICES,
};
