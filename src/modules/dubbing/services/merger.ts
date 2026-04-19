import * as fs from "fs/promises";
import * as path from "path";
import * as ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { execFile } from "child_process";

const execAsync = promisify(execFile);

export async function mergeVideoAudio(
  videoBuffer: Buffer,
  audioPaths: string[],
  assPath: string | undefined,
  outputDir: string
): Promise<Buffer> {
  const inputPath = path.join(outputDir, "input.mp4");
  const concatPath = path.join(outputDir, "concat.txt");
  const audioListPath = path.join(outputDir, "audio_list.txt");
  const mergedAudioPath = path.join(outputDir, "merged.mp3");
  const outputPath = path.join(outputDir, "output.mp4");

  await fs.writeFile(inputPath, videoBuffer);

  // Write audio concat list
  const audioList = audioPaths.map(p => `file '${p}'`).join("\n");
  await fs.writeFile(audioListPath, audioList);

  // Concatenate audio files
  await execAsync("ffmpeg", [
    "-f", "concat",
    "-safe", "0",
    "-i", audioListPath,
    "-c", "copy",
    mergedAudioPath,
  ]);

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath)
      .audioCodec("aac")
      .audioFrequency(48000);

    if (assPath) {
      cmd = cmd
        .metadata("title", "Myanmar Dubbed")
        .outputOptions([
          "-vf", `subtitles='${assPath}'`,
        ]);
    }

    cmd.on("end", async () => {
      const result = await fs.readFile(outputPath);
      resolve(result);
    }).on("error", reject).save(outputPath);
  });
}