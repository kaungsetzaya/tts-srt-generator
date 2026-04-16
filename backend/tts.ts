import { randomBytes } from "crypto";
import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = path.join(process.cwd(), "static", "output");

// Ensure output directory exists
await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

export const SUPPORTED_VOICES = {
  thiha: { name: "Thiha", shortName: "my-MM-ThihaNeural" },
  nilar: { name: "Nilar", shortName: "my-MM-NilarNeural" },
};

export type VoiceKey = keyof typeof SUPPORTED_VOICES;

// Simple replacement for nanoid using built-in crypto
function generateId(length: number = 10): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export async function generateSpeech(
  text: string,
  voice: VoiceKey = "thiha",
  rate: number = 1.0,
  pitch: number = 0
) {
  const voiceConfig = SUPPORTED_VOICES[voice];
  const ratePercent = Math.round((rate - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

  const id = generateId(10);
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.writeFile(tmpText, text, "utf8");

  try {
    await execFileAsync("edge-tts", [
      "--voice", voiceConfig.shortName,
      "--rate", rateStr,
      "--pitch", pitchStr,
      "--file", tmpText,
      "--write-media", audioPath,
      "--write-subtitles", srtPath,
    ], { timeout: 60000 });

    const audioBuffer = await fs.readFile(audioPath);
    const srtContent = await fs.readFile(srtPath, "utf8").catch(() => "");

    return { audioBuffer, srtContent, durationMs: 0 };
  } finally {
    await fs.unlink(tmpText).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
  }
}
