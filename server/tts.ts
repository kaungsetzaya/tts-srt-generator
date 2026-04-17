import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR =
  process.env.EDGE_TTS_OUTPUT_DIR ?? path.join(process.cwd(), "output");

// Ensure output directory exists
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
  console.log(
    `[CHARACTER TTS] Converting to ${characterKey} (${char.name}) using base voice ${char.base}`
  );

  // Step 1: Generate base TTS with Thiha or Nilar (pitch is now configurable)
  console.log(
    `[CHARACTER TTS] Step 1: Generating base speech with ${char.base}...`
  );
  const baseResult = await generateSpeech(
    text,
    char.base,
    rate,
    pitch,
    aspectRatio
  );
  console.log(
    `[CHARACTER TTS] Base speech generated: ${baseResult.audioBuffer.length} bytes, ${baseResult.durationMs}ms`
  );

  // Step 2: Convert voice with murf.ai
  const murfApiKey = getMurfKey();
  if (!murfApiKey) {
    console.error("[CHARACTER TTS] MURF_API_KEY not configured");
    throw new Error(
      "MURF_API_KEY not configured. Please set the environment variable."
    );
  }
  console.log(
    `[CHARACTER TTS] Step 2: Converting voice with Murf.ai (key index: ${currentMurfKeyIndex})...`
  );

  const { FormData, Blob } = await import("formdata-node");
  const form = new FormData();
  form.set("voice_id", char.murfId);
  form.set("format", "MP3");
  form.set(
    "file",
    new Blob([baseResult.audioBuffer], { type: "audio/mpeg" }),
    "audio.mp3"
  );

  console.log(
    `[CHARACTER TTS] Sending to Murf API: voice_id=${char.murfId}, format=MP3`
  );
  const response = await fetch("https://api.murf.ai/v1/voice-changer/convert", {
    method: "POST",
    headers: { "api-key": murfApiKey },
    body: form as any,
  });

  console.log(`[CHARACTER TTS] Murf API response status: ${response.status}`);
  const result = (await response.json()) as any;
  if (result.error_code) {
    console.error("[CHARACTER TTS] Murf API error:", result.error_message);
    throw new Error(result.error_message);
  }

  // Download converted audio
  console.log(
    `[CHARACTER TTS] Downloading converted audio from: ${result.audio_file}`
  );
  const audioResponse = await fetch(result.audio_file);
  const convertedBuffer = Buffer.from(await audioResponse.arrayBuffer());
  console.log(
    `[CHARACTER TTS] Character voice conversion complete: ${convertedBuffer.length} bytes`
  );

  return {
    audioBuffer: convertedBuffer,
    srtContent: baseResult.srtContent,
    rawSrt: baseResult.rawSrt,
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

  // Myanmar TTS voices (ThihaNeural/NilarNeural) naturally speak slowly at +0%
  // Add +25% baseline boost so user's "1.0x" (normal) feels like natural conversation speed
  const MYANMAR_SPEED_BOOST = 25;
  const ratePercent = Math.round((rate - 1.0) * 100) + MYANMAR_SPEED_BOOST;
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const clampedPitch = Math.max(-20, Math.min(20, pitch));
  const pitchStr =
    clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  const id = nanoid(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.writeFile(tmpText, text, "utf8");

  await acquireSlot();
  try {
    // Use python -m edge_tts to ensure we find the module
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
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
          "--rate",
          rateStr,
          `--pitch=${pitchStr}`,
          "--file",
          tmpText,
          "--write-media",
          audioPath,
          "--write-subtitles",
          srtPath,
        ],
        {
          env: {
            ...process.env,
            HTTPS_PROXY: process.env.EDGE_TTS_PROXY ?? "",
            HTTP_PROXY: process.env.EDGE_TTS_PROXY ?? "",
          },
        }
      );
    } catch (execError: any) {
      console.error("[EDGE-TTS EXEC ERROR]", execError);
      console.error("[EDGE-TTS STDERR]", execError.stderr?.toString());
      console.error("[EDGE-TTS STDOUT]", execError.stdout?.toString());
      throw new Error(
        `edge-tts failed: ${execError.stderr?.toString() || execError.message}`
      );
    }

    // Check if files were created
    try {
      const audioBuffer = await fs.readFile(audioPath);
      console.log(
        `[EDGE-TTS] Audio generated: ${audioPath} (${audioBuffer.length} bytes)`
      );

      let rawSrt = "";
      try {
        rawSrt = await fs.readFile(srtPath, "utf8");
        console.log(
          `[EDGE-TTS] SRT generated: ${srtPath} (${rawSrt.length} chars)`
        );
      } catch (srtError) {
        console.warn("[EDGE-TTS] SRT file not found, generating from text");
        rawSrt = "";
      }

      const durationMs = parseLastEndTime(rawSrt);
      const charsPerLine = aspectRatio === "9:16" ? 16 : 22;
      const srtContent = buildSRT(text, durationMs, charsPerLine);

      return { audioBuffer, srtContent, rawSrt, durationMs };
    } catch (fileError: any) {
      console.error("[EDGE-TTS FILE ERROR]", fileError);
      throw new Error(`Failed to read generated files: ${fileError.message}`);
    }
  } finally {
    releaseSlot();
    // Cleanup temp files
    await Promise.all([
      fs.unlink(tmpText).catch(() => {}),
      fs.unlink(audioPath).catch(() => {}),
      fs.unlink(srtPath).catch(() => {}),
    ]);
  }
}

function parseLastEndTime(srt: string): number {
  const matches = Array.from(
    srt.matchAll(/\d{2}:\d{2}:\d{2},\d{3} --> (\d{2}:\d{2}:\d{2},\d{3})/g)
  );
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
  return new Promise(resolve =>
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    })
  );
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
function graphemeLen(s: string): number {
  return Array.from(segmenter.segment(s)).length;
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

  // Step 4: distribute duration by word count
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

export function generateSRT(text: string, rate: number = 1.0): string {
  return "";
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
