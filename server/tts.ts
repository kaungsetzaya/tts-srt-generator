import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = process.env.EDGE_TTS_OUTPUT_DIR ?? path.join(process.cwd(), "output");

await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

export const SUPPORTED_VOICES = {
  thiha: { name: "Thiha", shortName: "my-MM-ThihaNeural" },
  nilar: { name: "Nilar", shortName: "my-MM-NilarNeural" },
};

export type VoiceKey = keyof typeof SUPPORTED_VOICES;

export interface GenerateResult {
  audioBuffer: Buffer;
  srtContent: string;
  durationMs: number;
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

  const ratePercent = Math.round((rate - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const clampedPitch = Math.max(-20, Math.min(20, pitch));
  const pitchStr = clampedPitch >= 0 ? `+${clampedPitch}Hz` : `${clampedPitch}Hz`;

  const id = nanoid(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.writeFile(tmpText, text, "utf8");

  try {
    await execFileAsync("edge-tts", [
      "--voice", voiceConfig.shortName,
      "--rate", rateStr,
      `--pitch=${pitchStr}`,
      "--file", tmpText,
      "--write-media", audioPath,
      "--write-subtitles", srtPath,
    ], {
      env: { ...process.env, PATH: process.env.PATH },
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
