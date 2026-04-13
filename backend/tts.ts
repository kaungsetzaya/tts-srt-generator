import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = process.env.EDGE_TTS_OUTPUT_DIR ?? path.join(process.cwd(), "output");

await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

let currentMurfKeyIndex = 0;
function getMurfKey(): string | undefined {
  const keysStr = process.env.MURF_API_KEY || "";
  const keys = keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
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
  ryan:      { name: "ရဲရင့်",   gender: "male",   murfId: "en-US-ryan",      base: "thiha" as const },
  ronnie:    { name: "ရောင်နီ",  gender: "male",   murfId: "en-US-ronnie",    base: "thiha" as const },
  lucas:     { name: "လင်းခန့်", gender: "male",   murfId: "en-US-lucas",     base: "thiha" as const },
  daniel:    { name: "ဒေဝ",      gender: "male",   murfId: "en-US-daniel",    base: "thiha" as const },
  evander:   { name: "အဂ္ဂ",     gender: "male",   murfId: "en-US-evander",   base: "thiha" as const },
  michelle:  { name: "မေချို",   gender: "female", murfId: "en-US-michelle",  base: "nilar" as const },
  iris:      { name: "အိန္ဒြာ",  gender: "female", murfId: "en-US-iris",      base: "nilar" as const },
  charlotte: { name: "သီရိ",     gender: "female", murfId: "en-US-charlotte", base: "nilar" as const },
  amara:     { name: "အမရာ",     gender: "female", murfId: "en-US-amara",     base: "nilar" as const },
};

export type CharacterKey = keyof typeof CHARACTER_VOICES;

export interface GenerateResult {
  audioBuffer: Buffer;
  srtContent: string;
  rawSrt: string;  // Raw edge-tts word-level SRT for precise timing
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
  const baseResult = await generateSpeech(text, char.base, rate, pitch, aspectRatio);
  // Step 2: Convert voice with murf.ai
  const murfApiKey = getMurfKey();
  if (!murfApiKey) throw new Error("MURF_API_KEY not configured");

  const { FormData, Blob } = await import("formdata-node");
  const form = new FormData();
  form.set("voice_id", char.murfId);
  form.set("format", "MP3");
  form.set("file", new Blob([baseResult.audioBuffer], { type: "audio/mpeg" }), "audio.mp3");

  const response = await fetch("https://api.murf.ai/v1/voice-changer/convert", {
    method: "POST",
    headers: { "api-key": murfApiKey },
    body: form as any,
  });

  const result = await response.json() as any;
  if (result.error_code) throw new Error(result.error_message);

  // Download converted audio
  const audioResponse = await fetch(result.audio_file);
  const convertedBuffer = Buffer.from(await audioResponse.arrayBuffer());

  return {
    audioBuffer: convertedBuffer,
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
  const pitchStr = clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  const id = nanoid(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.writeFile(tmpText, text, "utf8");

  await acquireSlot();
  try {
    await execFileAsync("edge-tts", [
      "--voice", voiceConfig.shortName,
      "--rate", rateStr,
      `--pitch=${pitchStr}`,
      "--file", tmpText,
      "--write-media", audioPath,
      "--write-subtitles", srtPath,
    ], {
      env: { ...process.env, PATH: process.env.PATH, HTTPS_PROXY: (() => { const h=process.env.EDGE_TTS_PROXY_HOST,p=process.env.EDGE_TTS_PROXY_PORT,u=process.env.EDGE_TTS_PROXY_USER,s=process.env.EDGE_TTS_PROXY_PASS; return (h&&p&&u&&s) ? `http://${u}:${s}@${h}:${p}` : ""; })(), HTTP_PROXY: (() => { const h=process.env.EDGE_TTS_PROXY_HOST,p=process.env.EDGE_TTS_PROXY_PORT,u=process.env.EDGE_TTS_PROXY_USER,s=process.env.EDGE_TTS_PROXY_PASS; return (h&&p&&u&&s) ? `http://${u}:${s}@${h}:${p}` : ""; })() },
    });

    const audioBuffer = await fs.readFile(audioPath);

    let rawSrt = "";
    try {
      rawSrt = await fs.readFile(srtPath, "utf8");
    } catch {
      rawSrt = "";
    }

    const durationMs = parseLastEndTime(rawSrt);
    const charsPerLine = aspectRatio === "9:16" ? 16 : 22;
    const srtContent = buildSRT(text, durationMs, charsPerLine);

    return { audioBuffer, srtContent, durationMs };
  } finally {
    releaseSlot();
    await fs.unlink(tmpText).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
  }
}

function parseLastEndTime(srt: string): number {
  const matches = [...srt.matchAll(/\d{2}:\d{2}:\d{2},\d{3} --> (\d{2}:\d{2}:\d{2},\d{3})/g)];
  if (matches.length === 0) return 0;
  return srtTimeToMs(matches[matches.length - 1][1]);
}

function srtTimeToMs(time: string): number {
  const [hms, ms] = time.split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return (h * 3600 + m * 60 + s) * 1000 + Number(ms);
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mil, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

// Concurrency queue — max 3 simultaneous edge-tts calls
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return;
  }
  return new Promise(resolve => waitQueue.push(() => { activeRequests++; resolve(); }));
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
function graphemeLen(s: string): number {
  return [...segmenter.segment(s)].length;
}

function buildSRT(text: string, durationMs: number, charsPerLine: number): string {
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return "";

  // Step 1: split into segments by sentence boundary (။ ၊)
  // Each segment is an array of tokens belonging to one sentence
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

  // Step 2: within each segment, split into lines by charsPerLine
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

  // Step 3: simple 2-line blocks
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

  // Merge any trailing solo block into previous
  const blocks: string[][] = [];
  for (let j = 0; j < rawBlocks.length; j++) {
    if (rawBlocks[j].length === 1 && blocks.length > 0 && blocks[blocks.length - 1].length === 1) {
      blocks[blocks.length - 1].push(rawBlocks[j][0]);
    } else {
      blocks.push([...rawBlocks[j]]);
    }
  }

  // Step 4: distribute duration by word count
  const blockWordCounts = blocks.map(b =>
    b.join(" ").split(/\s+/).filter(t => t.length > 0).length
  );
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

export function generateSRT(text: string, rate: number = 1.0): string {
  return "";
}

export function formatSrtTime(ms: number): string {
  return msToSrtTime(ms);
}

export function estimateSpeechDuration(text: string, rate: number = 1.0): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount * 400) / rate);
}
