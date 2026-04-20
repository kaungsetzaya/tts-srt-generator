import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FFmpeg Service - Strictly isolates all FFmpeg/fluent-ffmpeg logic.
 * Per ARCHITECTURE.md, no other module may directly use FFmpeg.
 */

export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

export async function getAudioDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else resolve(Math.round((metadata.format.duration || 0) * 1000));
    });
  });
}

export async function getVideoSize(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else {
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
        resolve({
          width: videoStream?.width || 1920,
          height: videoStream?.height || 1080,
        });
      }
    });
  });
}

/**
 * Extract audio from video file to mp3.
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioQuality(2)
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

/**
 * Geneate a silent mp3 file of specific duration.
 */
export async function generateSilence(durationMs: number, outputPath: string): Promise<void> {
  if (durationMs <= 0) return;
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("anullsrc=r=24000:cl=mono")
      .inputFormat("lavfi")
      .duration(durationMs / 1000)
      .audioCodec("libmp3lame")
      .audioBitrate("32k") // Match edge-tts low bitrate
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

/**
 * Adjust audio speed using atempo filters.
 */
export async function speedUpAudio(
  inputPath: string,
  outputPath: string,
  ratio: number
): Promise<void> {
  const filters: string[] = [];
  let r = ratio;

  while (r > 2.0) {
    filters.push("atempo=2.0");
    r /= 2.0;
  }
  while (r < 0.5) {
    filters.push("atempo=0.5");
    r /= 0.5;
  }
  filters.push(`atempo=${r.toFixed(4)}`);

  const filterStr = filters.join(",");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filterStr)
      .audioCodec("libmp3lame")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

/**
 * Merge audio into video, burning in ASS subtitles.
 */
export async function mergeVideoAudioSubtitles(
    videoPath: string,
    audioPath: string,
    subtitlesPath: string,
    outputPath: string,
    options: {
        fontPath?: string,
        videoDurationSec: number,
        onProgress?: (progress: number) => void
    }
): Promise<void> {
    return new Promise((resolve, reject) => {
        let subFilter: string;
        if (options.fontPath) {
            const p = subtitlesPath.replace(/\\/g, "/");
            const fd = path.dirname(options.fontPath).replace(/\\/g, "/");
            const escapedP = p.replace(/:/g, "\\:");
            
            // On Linux, if the font is in a standard system path, we avoid fontsdir 
            // as it can cause metadata loading errors with some Noto fonts.
            if (process.platform !== "win32" && fd.startsWith("/usr/share/fonts")) {
                subFilter = `ass='${escapedP}'`;
            } else {
                const escapedFd = fd.replace(/:/g, "\\:");
                subFilter = `ass='${escapedP}':fontsdir='${escapedFd}'`;
            }
        } else {
            const p = subtitlesPath.replace(/\\/g, "/");
            const escapedP = p.replace(/:/g, "\\:");
            subFilter = `subtitles='${escapedP}'`;
        }

        ffmpeg(videoPath)
            .input(audioPath)
            .outputOptions([
                "-vf", subFilter,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "28",
                "-c:a", "aac",
                "-b:a", "128k",
                "-map", "0:v",
                "-map", "1:a",
                "-t", options.videoDurationSec.toFixed(3),
                "-map_metadata", "-1",
                "-movflags", "+faststart"
            ])
            .on("progress", (p: any) => options.onProgress?.(p.percent ?? 0))
            .on("stderr", (line: string) => {
              if (line.includes("Error") || line.includes("fail")) {
                console.error(`[FFmpeg Subtitles] ${line}`);
              }
            })
            .on("error", (err: any) => {
              console.error(`[FFmpeg MergeSubtitles Error] ${err.message}`);
              reject(err);
            })
            .on("end", () => {
              console.log("[FFmpeg Subtitles] Merge completed successfully.");
              resolve();
            })
            .save(outputPath);
    });
}

/**
 * Merge audio into video without subtitles.
 */
export async function mergeVideoAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    options: {
        videoDurationSec: number,
        onProgress?: (progress: number) => void
    }
): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .input(audioPath)
            .outputOptions([
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "128k",
                "-map", "0:v",
                "-map", "1:a",
                "-t", options.videoDurationSec.toFixed(3),
                "-map_metadata", "-1",
                "-movflags", "+faststart"
            ])
            .on("progress", (p: any) => options.onProgress?.(p.percent ?? 0))
            .on("stderr", (line: string) => {
              if (line.includes("Error") || line.includes("fail")) {
                console.error(`[FFmpeg Merge] ${line}`);
              }
            })
            .on("error", (err: any) => {
              console.error(`[FFmpeg Merge Error] ${err.message}`);
              reject(err);
            })
            .on("end", () => resolve())
            .save(outputPath);
    });
}

/**
 * Concatenate multiple audio files into one using ffmpeg concat demuxer.
 */
export async function concatAudioFiles(listPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(listPath)
            .inputFormat('concat')
            .inputOptions(['-safe', '0'])
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .on("stderr", (line: string) => {
              if (line.includes("Error") || line.includes("fail")) {
                console.error(`[FFmpeg Concat] ${line}`);
              }
            })
            .on('end', () => {
              console.log("[FFmpeg Concat] Audio concatenation completed.");
              resolve();
            })
            .on('error', (err: any) => {
              console.error(`[FFmpeg Concat Error] ${err.message}`);
              reject(err);
            })
            .save(outputPath);
    });
}

export const ffmpegService = {
    getVideoDuration,
    getAudioDurationMs,
    getVideoSize,
    extractAudio,
    generateSilence,
    speedUpAudio,
    mergeVideoAudioSubtitles,
    mergeVideoAudio,
    concatAudioFiles,
};
