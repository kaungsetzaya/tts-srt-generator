import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = path.join(process.cwd(), "static", "output");

export async function generateVpsSpeech(
  text: string,
  voice: string = "my-MM-ThihaNeural",
  rate: string = "+0%",
  pitch: string = "+0Hz"
) {
  const id = randomBytes(5).toString("hex");
  const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const srtPath = path.join(OUTPUT_DIR, `${id}.srt`);
  const tmpText = path.join(OUTPUT_DIR, `${id}.txt`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(tmpText, text, "utf8");

  try {
    await execFileAsync("edge-tts", [
      "--voice", voice,
      "--rate", rate,
      "--pitch", pitch,
      "--file", tmpText,
      "--write-media", audioPath,
      "--write-subtitles", srtPath,
    ], { timeout: 60000 });

    const audioBuffer = await fs.readFile(audioPath);
    const srtContent = await fs.readFile(srtPath, "utf8").catch(() => "");

    return { audioBuffer, srtContent };
  } finally {
    await fs.unlink(tmpText).catch(() => {});
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
  }
}
