import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR =
  process.env.EDGE_TTS_OUTPUT_DIR ?? path.join(process.cwd(), "output");

fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

let currentMurfKeyIndex = 0;
function getMurfKey(): string | undefined {
  const keysStr = process.env.MURF_API_KEY || "";
  const keys = keysStr
    .split(",")
    .map(k => k.trim())
    .filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  const key = keys[currentMurfKeyIndex % keys.length];
  currentMurfKeyIndex++;
  return key;
}

export const SUPPORTED_VOICES = {
  thiha: { name: "Thiha", shortName: "my-MM-ThihaNeural" },
  nilar: { name: "Nilar", shortName: "my-MM-NilarNeural" },
};

export type VoiceKey = keyof typeof SUPPORTED_VOICES;

export const CHARACTER_VOICES = {
  ryan: {
    name: "ရဲရင့်",
    gender: "male",
    murfId: "en-US-ryan",
    base: "thiha" as const,
  },
  ronnie: {
    name: "ရောင်နီ",
    gender: "male",
    murfId: "en-US-ronnie",
    base: "thiha" as const,
  },
  lucas: {
    name: "လင်းခန့်",
    gender: "male",
    murfId: "en-US-lucas",
    base: "thiha" as const,
  },
  daniel: {
    name: "ဒေဝ",
    gender: "male",
    murfId: "en-US-daniel",
    base: "thiha" as const,
  },
  evander: {
    name: "အဂ္ဂ",
    gender: "male",
    murfId: "en-US-evander",
    base: "thiha" as const,
  },
  michelle: {
    name: "မေချို",
    gender: "female",
    murfId: "en-US-michelle",
    base: "nilar" as const,
  },
  iris: {
    name: "အိန္ဒြာ",
    gender: "female",
    murfId: "en-US-iris",
    base: "nilar" as const,
  },
  charlotte: {
    name: "သီရိ",
    gender: "female",
    murfId: "en-US-charlotte",
    base: "nilar" as const,
  },
  amara: {
    name: "အမရာ",
    gender: "female",
    murfId: "en-US-amara",
    base: "nilar" as const,
  },
};

export type CharacterKey = keyof typeof CHARACTER_VOICES;

export interface GenerateResult {
  audioBuffer: Buffer;
  srtContent: string;
  rawSrt: string; // Raw edge-tts word-level SRT for precise timing
  durationMs: number;
}

export async function generateSpeechWithCharacter(
  text: string,
  characterKey: CharacterKey,
  rate: number = 1.0,
  aspectRatio: "9:16" | "16:9" = "16:9",
  pitch: number = 0
): Promise<GenerateResult> {
  const char = CHARACTER_VOICES[characterKey];
  // Step 1: Generate base TTS with Thiha or Nilar (pitch is now configurable)
  const baseResult = await generateSpeech(
    text,
    char.base,
    rate,
    pitch,
    aspectRatio
  );
  // Step 2: Convert voice with murf.ai
  const murfApiKey = getMurfKey();
  if (!murfApiKey) throw new Error("MURF_API_KEY not configured");

  const { FormData, Blob } = await import("formdata-node");
  const form = new FormData();
  form.set("voice_id", char.murfId);
  form.set("format", "MP3");
  form.set(
    "file",
    new Blob([baseResult.audioBuffer], { type: "audio/mpeg" }),
    "audio.mp3"
  );

  const response = await fetch("https://api.murf.ai/v1/voice-changer/convert", {
    method: "POST",
    headers: { "api-key": murfApiKey },
    body: form as any,
  });

  const result = (await response.json()) as any;
  if (result.error_code) throw new Error(result.error_message);

  // Download converted audio
  const audioResponse = await fetch(result.audio_file);
  const convertedBuffer = Buffer.from(await audioResponse.arrayBuffer());

  return {
    audioBuffer: convertedBuffer,
    rawSrt: baseResult.rawSrt ?? "",
    srtContent: baseResult.srtContent,
    durationMs: baseResult.durationMs,
  };
}

export async function generateSpeech(
  text: string,
  voice: VoiceKey = "thiha",
  rate: number = 1.0,
  pitch: number = 0,
  aspectRatio: "9:16" | "16:9" = "16:9"
): Promise<GenerateResult> {
  const voiceConfig = SUPPORTED_VOICES[voice];
  if (!voiceConfig) throw new Error(`Unsupported voice: ${voice}`);

  // Myanmar TTS voices (ThihaNeural/NilarNeural) naturally speak slowly
  // Apply boost as multiplier so all speeds work correctly
  const MYANMAR_SPEED_MULTIPLIER = 1.25; // 25% faster baseline
  const actualRate = rate * MYANMAR_SPEED_MULTIPLIER;
  const ratePercent = Math.round((actualRate - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const clampedPitch = Math.max(-20, Math.min(20, pitch));
  const pitchStr =
    clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  const id = nanoid(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.writeFile(tmpText, text, "utf8");

  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  // Note: slot acquisition is now handled by the caller (router or job processor)
  // via the centralized queue in jobs.ts
  try {
    console.log(
      `[EDGE-TTS] Running: ${pythonCmd} -m edge_tts --voice ${voiceConfig.shortName} --rate ${rateStr} --pitch=${pitchStr}`
    );
    try {
      await execFileAsync(
        pythonCmd,
        [
          "-m",
          "edge_tts",
          "--voice",
          voiceConfig.shortName,
          `--rate=${rateStr}`,
          `--pitch=${pitchStr}`,
          "--file",
          tmpText,
          "--write-media",
          audioPath,
          "--write-subtitles",
          srtPath,
        ],
        {
          timeout: 120000,
          env: {
            ...process.env,
            PATH: process.env.PATH,
            HTTPS_PROXY: (() => {
              const h = process.env.EDGE_TTS_PROXY_HOST,
                p = process.env.EDGE_TTS_PROXY_PORT,
                u = process.env.EDGE_TTS_PROXY_USER,
                s = process.env.EDGE_TTS_PROXY_PASS;
              return h && p && u && s ? `http://${u}:${s}@${h}:${p}` : "";
            })(),
            HTTP_PROXY: (() => {
              const h = process.env.EDGE_TTS_PROXY_HOST,
                p = process.env.EDGE_TTS_PROXY_PORT,
                u = process.env.EDGE_TTS_PROXY_USER,
                s = process.env.EDGE_TTS_PROXY_PASS;
              return h && p && u && s ? `http://${u}:${s}@${h}:${p}` : "";
            })(),
          },
        }
      );
    } catch (execErr: any) {
      console.error("[EDGE-TTS EXEC ERROR]", execErr?.message || execErr);
      console.error("[EDGE-TTS STDERR]", execErr?.stderr?.toString());
      console.error("[EDGE-TTS STDOUT]", execErr?.stdout?.toString());
      throw new Error(
        execErr?.message?.includes("ENOENT")
          ? "edge-tts not found. Is it installed?"
          : `edge-tts failed: ${execErr?.stderr?.toString() || execErr?.message || "Unknown error"}`
      );
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = await fs.readFile(audioPath);
    } catch (readErr: any) {
      console.error("[edge-tts audio read error]", readErr?.message || readErr);
      throw new Error("Failed to read generated audio file.");
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      console.error("[edge-tts] Generated audio file is empty");
      throw new Error("Failed to generate audio.");
    }

    let rawSrt = "";
    try {
      rawSrt = await fs.readFile(srtPath, "utf8");
    } catch {
      rawSrt = "";
    }

    const durationMs = parseLastEndTime(rawSrt);

    // Use raw edge-tts timing data for accurate SRT timestamps
    const srtContent = buildSRTFromRaw(rawSrt, text, aspectRatio);

    return { audioBuffer, rawSrt, srtContent, durationMs };
  } finally {
    await fs.unlink(tmpText).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
  }
}

function parseLastEndTime(srt: string): number {
  const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const matches = [
    ...normalized.matchAll(/\d{2}:\d{2}:\d{2},\d{3} --> (\d{2}:\d{2}:\d{2},\d{3})/g),
  ];
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

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

// Concurrency is now managed by the centralized queue in jobs.ts
// Callers (tts.router.ts, videoDubber.ts) acquire/release slots there.

const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
function graphemeLen(s: string): number {
  return [...segmenter.segment(s)].length;
}

// ─── Burmese SRT constants ───────────────────────────────────────────────────
const BURMESE_SRT_CONFIG = {
  "16:9": { charsPerLine: 20 },
  "9:16": { charsPerLine: 14 },
} as const;

const MIN_CUE_MS = 800;   // minimum cue display duration (ms)
const FRAME_GAP_MS = 42;  // inter-cue gap so editors see separate segments

// ─── Burmese sentence boundary ───────────────────────────────────────────────
// ။ = full stop (U+104B), ၊ = comma/clause separator (U+104A)
const BURMESE_BOUNDARY_RE = /[။၊]/;

interface WordEntry {
  startMs: number;
  endMs: number;
  text: string;
}

function parseRawSrt(rawSrt: string): WordEntry[] {
  const entries: WordEntry[] = [];
  const normalized = rawSrt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue;

    entries.push({
      startMs: srtTimeToMs(timeMatch[1]),
      endMs: srtTimeToMs(timeMatch[2]),
      text: lines.slice(2).join(" ").trim(),
    });
  }

  return entries;
}

function buildSRTFromRaw(
  rawSrt: string,
  originalText: string,
  aspectRatio: "9:16" | "16:9"
): string {
  const { charsPerLine } = BURMESE_SRT_CONFIG[aspectRatio] ?? BURMESE_SRT_CONFIG["16:9"];
  const words = parseRawSrt(rawSrt);

  if (words.length === 0) {
    return buildSRT(originalText, 0, charsPerLine);
  }

  const tokens = originalText
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0);
  if (tokens.length === 0) return "";

  const tokenEntries: { token: string; startMs: number; endMs: number }[] = tokens.map(
    (token, i) => {
      if (i < words.length) {
        return { token, startMs: words[i].startMs, endMs: words[i].endMs };
      }
      const last = words[words.length - 1];
      return { token, startMs: last.endMs, endMs: last.endMs + 200 };
    }
  );

  // ── Step 1: group tokens into sentences at Burmese boundary characters ──
  const sentences: (typeof tokenEntries)[] = [];
  let cur: typeof tokenEntries = [];
  for (const entry of tokenEntries) {
    cur.push(entry);
    if (BURMESE_BOUNDARY_RE.test(entry.token)) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) sentences.push(cur);

  // ── Step 2: within each sentence, wrap into display lines ──
  interface DisplayLine {
    text: string;
    startMs: number;
    endMs: number;
    sentenceEnd: boolean;
  }
  const displayLines: DisplayLine[] = [];

  for (const sentence of sentences) {
    let lineTokens: string[] = [];
    let lineChars = 0;
    let lineStart = sentence[0].startMs;
    let lineEnd = sentence[0].endMs;

    for (const entry of sentence) {
      const glen = graphemeLen(entry.token);
      if (lineChars > 0 && lineChars + 1 + glen > charsPerLine) {
        displayLines.push({
          text: lineTokens.join(" "),
          startMs: lineStart,
          endMs: lineEnd,
          sentenceEnd: false,
        });
        lineTokens = [];
        lineChars = 0;
        lineStart = entry.startMs;
      }
      lineTokens.push(entry.token);
      lineChars += (lineChars > 0 ? 1 : 0) + glen;
      lineEnd = entry.endMs;
    }
    if (lineTokens.length > 0) {
      displayLines.push({
        text: lineTokens.join(" "),
        startMs: lineStart,
        endMs: lineEnd,
        sentenceEnd: true,
      });
    }
  }

  // ── Step 3: pair display lines into 2-line cues ──
  interface Cue {
    lines: string[];
    startMs: number;
    endMs: number;
  }
  const cues: Cue[] = [];
  let i = 0;
  while (i < displayLines.length) {
    const first = displayLines[i];
    if (!first.sentenceEnd && i + 1 < displayLines.length) {
      const second = displayLines[i + 1];
      cues.push({
        lines: [first.text, second.text],
        startMs: first.startMs,
        endMs: second.endMs,
      });
      i += 2;
    } else {
      cues.push({
        lines: [first.text],
        startMs: first.startMs,
        endMs: first.endMs,
      });
      i++;
    }
  }

  // ── Step 4: enforce minimum duration and inter-cue frame gap ──
  for (let j = 0; j < cues.length; j++) {
    const nextStart = j + 1 < cues.length ? cues[j + 1].startMs : Infinity;
    const maxEnd = nextStart - FRAME_GAP_MS;

    // ပြင်ဆင်ချက်: မူလကြာချိန် (သို့) အနည်းဆုံးကြာချိန် ထဲမှ ပိုများသောတန်ဖိုးကို ယူပါမည်
    const desiredEnd = Math.max(cues[j].endMs, cues[j].startMs + MIN_CUE_MS);
    cues[j].endMs = Math.min(desiredEnd, maxEnd);

    // Safety floor: ensure endMs is always after startMs
    if (cues[j].endMs <= cues[j].startMs) {
      cues[j].endMs = cues[j].startMs + 100;
    }
  }

  // ── Step 5: serialise to SRT ──
  const result: string[] = [];
  for (let idx = 0; idx < cues.length; idx++) {
    result.push(`${idx + 1}`);
    result.push(
      `${msToSrtTime(cues[idx].startMs)} --> ${msToSrtTime(cues[idx].endMs)}`
    );
    result.push(cues[idx].lines.join("\n"));
    result.push("");
  }

  return result.join("\n");
}

function buildSRT(
  text: string,
  durationMs: number,
  charsPerLine: number
): string {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0);
  if (tokens.length === 0) return "";

  // ── Step 1: split into sentences at Burmese boundary characters ──
  const sentences: string[][] = [];
  let cur: string[] = [];
  for (const token of tokens) {
    cur.push(token);
    if (BURMESE_BOUNDARY_RE.test(token)) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) sentences.push(cur);

  // ── Step 2: wrap each sentence into display lines ──
  const lines: string[] = [];
  for (const seg of sentences) {
    let current: string[] = [];
    let currentChars = 0;
    for (const token of seg) {
      const glen = graphemeLen(token);
      if (currentChars > 0 && currentChars + 1 + glen > charsPerLine) {
        lines.push(current.join(" "));
        current = [];
        currentChars = 0;
      }
      current.push(token);
      currentChars += (currentChars > 0 ? 1 : 0) + glen;
    }
    if (current.length > 0) lines.push(current.join(" "));
  }

  // ── Step 3: pair into 2-line blocks ──
  const rawBlocks: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (i + 1 < lines.length) {
      rawBlocks.push([lines[i], lines[i + 1]]);
      i += 2;
    } else {
      rawBlocks.push([lines[i]]);
      i++;
    }
  }

  // Merge any trailing solo block into the previous one
  const blocks: string[][] = [];
  for (let j = 0; j < rawBlocks.length; j++) {
    if (
      rawBlocks[j].length === 1 &&
      blocks.length > 0 &&
      blocks[blocks.length - 1].length === 1
    ) {
      blocks[blocks.length - 1].push(rawBlocks[j][0]);
    } else {
      blocks.push([...rawBlocks[j]]);
    }
  }

  // ── Step 4: distribute duration proportionally by grapheme count ──
  const blockGLen = blocks.map(b =>
    b
      .join(" ")
      .split(/\s+/)
      .filter(t => t.length > 0)
      .reduce((acc, t) => acc + graphemeLen(t), 0)
  );
  const totalGLen = blockGLen.reduce((a, b) => a + b, 0);

  const result: string[] = [];
  let currentMs = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const blockDuration = Math.max(
      MIN_CUE_MS,
      Math.round((blockGLen[idx] / totalGLen) * durationMs)
    );
    const startMs = currentMs;
    const endMs =
      idx === blocks.length - 1 ? durationMs : currentMs + blockDuration;
    currentMs = endMs + FRAME_GAP_MS;

    result.push(`${idx + 1}`);
    result.push(`${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}`);
    result.push(blocks[idx].join("\n"));
    result.push("");
  }

  return result.join("\n");
}

export function generateSRT(text: string, durationMs: number = 0): string {
  // Estimate duration if not provided: 400ms per word
  const wordCount = text.trim().split(/\s+/).length;
  const estDuration = durationMs || wordCount * 400;
  return buildSRT(text, estDuration, 40);
}

export function formatSrtTime(ms: number): string {
  return msToSrtTime(ms);
}

export function estimateSpeechDuration(
  text: string,
  rate: number = 1.0
): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount * 400) / rate);
}