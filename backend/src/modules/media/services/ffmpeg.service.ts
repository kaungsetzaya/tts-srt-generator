import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * FFmpeg Service - Strictly isolates all FFmpeg/fluent-ffmpeg logic.
 * Per ARCHITECTURE.md, no other module may directly use FFmpeg.
 *
 * Audio normalization standard (all clips must match for clean concat):
 *   - Sample rate : 44100 Hz
 *   - Channels    : 1 (mono)
 *   - Bitrate     : 128k
 */

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Standard audio spec (must match across ALL generated clips) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNELS    = 1;
const AUDIO_BITRATE     = '128k';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Floating-point safe speed ratio check Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const needsSpeedChange = (ratio: number) => Math.abs(ratio - 1.0) > 0.005;

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
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
        resolve({
          width:  videoStream?.width  || 1920,
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
      .audioCodec('libmp3lame')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .audioQuality(2)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Generate a silent mp3 clip of specific duration.
 * FIXED: was 24000Hz Ã¢â‚¬â€ now matches TTS standard (44100Hz mono 128k).
 * Mismatch caused crackling and timing gaps during concat.
 */
export async function generateSilence(durationMs: number, outputPath: string): Promise<void> {
  if (durationMs <= 0) return;
  const durationSec = (durationMs / 1000).toFixed(6);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=mono`)
      .inputFormat('lavfi')
      .duration(parseFloat(durationSec))
      .audioCodec('libmp3lame')
      .audioBitrate(AUDIO_BITRATE)
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Apply an ffmpeg audio filter to a clip (used for atempo speed adjustment).
 * Normalizes output to standard audio spec for clean concat.
 */
export async function runFilter(inputPath: string, filter: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filter)
      .audioCodec('libmp3lame')
      .audioBitrate(AUDIO_BITRATE)
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Trim an audio file to [startMs, endMs].
 * Last resort when atempo ratio exceeds 2.5x (Burmese unintelligible beyond that).
 */
export async function trimAudio(
  inputPath: string,
  startMs: number,
  endMs: number,
  outputPath: string
): Promise<void> {
  const startSec    = (startMs / 1000).toFixed(3);
  const durationSec = ((endMs - startMs) / 1000).toFixed(3);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(parseFloat(startSec))
      .duration(parseFloat(durationSec))
      .audioCodec('libmp3lame')
      .audioBitrate(AUDIO_BITRATE)
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Adjust audio speed using chained atempo filters.
 * atempo only accepts 0.5Ã¢â‚¬â€œ2.0 per stage Ã¢â‚¬â€ chain stages for wider range.
 */
export async function speedUpAudio(
  inputPath: string,
  outputPath: string,
  ratio: number
): Promise<void> {
  const filters: string[] = [];
  let r = ratio;
  while (r > 2.0) { filters.push('atempo=2.0'); r /= 2.0; }
  while (r < 0.5) { filters.push('atempo=0.5'); r *= 2.0; }
  filters.push(`atempo=${r.toFixed(6)}`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filters.join(','))
      .audioCodec('libmp3lame')
      .audioBitrate(AUDIO_BITRATE)
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Concatenate multiple audio files into one using ffmpeg concat demuxer.
 * FIXED: was 192k Ã¢â‚¬â€ now 128k to match all generated clips (silence, TTS, trimmed).
 * Bitrate mismatch was causing ffmpeg to resample and introduce timing drift.
 */
export async function concatAudioFiles(listPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputFormat('concat')
      .inputOptions(['-safe', '0'])
      .audioCodec('libmp3lame')
      .audioBitrate(AUDIO_BITRATE)
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('stderr', (line: string) => {
        if (line.includes('Error') || line.includes('fail')) {
          console.error(`[FFmpeg Concat] ${line}`);
        }
      })
      .on('end', () => {
        console.log('[FFmpeg Concat] Audio concatenation completed.');
        resolve();
      })
      .on('error', (err: any) => {
        console.error(`[FFmpeg Concat Error] ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Merge audio into video, burning in ASS subtitles.
 * FIXED: floating-point safe ratio check (was !== 1.0, now abs diff > 0.005).
 * Pipeline passes videoSpeedRatio=1.0 Ã¢â‚¬â€ no video stretch applied.
 */
export async function mergeVideoAudioSubtitles(
  videoPath: string,
  audioPath: string,
  subtitlesPath: string,
  outputPath: string,
  options: {
    fontPath?: string;
    videoDurationSec: number;
    videoSpeedRatio?: number;
    onProgress?: (progress: number) => void;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Build subtitle filter string
    let subFilter: string;
    if (options.fontPath) {
      const p   = subtitlesPath.replace(/\\/g, '/');
      const fd  = path.dirname(options.fontPath).replace(/\\/g, '/');
      const escapedP  = p.replace(/:/g, '\\:');
      // On Linux with system font path Ã¢â‚¬â€ skip fontsdir to avoid Noto metadata errors
      if (process.platform !== 'win32' && fd.startsWith('/usr/share/fonts')) {
        subFilter = `ass='${escapedP}'`;
      } else {
        const escapedFd = fd.replace(/:/g, '\\:');
        subFilter = `ass='${escapedP}':fontsdir='${escapedFd}'`;
      }
    } else {
      const escapedP = subtitlesPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      subFilter = `subtitles='${escapedP}'`;
    }

    // FIXED: use abs diff check Ã¢â‚¬â€ floating point 1.0000001 !== 1.0 caused
    // unnecessary re-encode even when pipeline passed videoSpeedRatio=1.0
    const speedRatio  = options.videoSpeedRatio ?? 1.0;
    const applyStretch = needsSpeedChange(speedRatio);

    // setpts: >1 slows video down, <1 speeds up
    // e.g. ratio=1.2 (audio 20% longer) Ã¢â€ â€™ setpts=1.200000*PTS (slow video to match)
    const videoFilter = applyStretch
      ? `${subFilter},setpts=${speedRatio.toFixed(6)}*PTS`
      : subFilter;

    // We use sidechaincompress to naturally return original audio to full volume during pauses!
    const audioDuckingFilter = `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.5[a1]`;
    const complexFilterStr = `[0:v]${videoFilter}[vout];${audioDuckingFilter}`;

    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        '-filter_complex', complexFilterStr,
        '-c:v',        'libx264',
        '-preset',     'ultrafast',
        '-crf',        '28',
        '-c:a',        'aac',
        '-b:a',        '128k',
        '-map',        '[vout]',
        '-map',        '[a1]',
        '-t',          options.videoDurationSec.toFixed(3),
        '-map_metadata', '-1',
        '-movflags',   '+faststart',
      ])
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('stderr', (line: string) => {
        if (line.includes('Error') || line.includes('fail')) {
          console.error(`[FFmpeg Subtitles] ${line}`);
        }
      })
      .on('error', (err: any) => {
        console.error(`[FFmpeg MergeSubtitles Error] ${err.message}`);
        reject(err);
      })
      .on('end', () => {
        console.log('[FFmpeg Subtitles] Merge completed successfully.');
        resolve();
      })
      .save(outputPath);
  });
}

/**
 * Merge audio into video without subtitles.
 * FIXED: "-c:v copy" was passed as single string in outputOptions array Ã¢â‚¬â€
 * fluent-ffmpeg treats it as one flag, ffmpeg rejects it. Now split correctly.
 * FIXED: floating-point safe ratio check.
 */
export async function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  options: {
    videoDurationSec: number;
    videoSpeedRatio?: number;
    onProgress?: (progress: number) => void;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const speedRatio   = options.videoSpeedRatio ?? 1.0;
    const applyStretch = needsSpeedChange(speedRatio);
    const videoFilter  = applyStretch ? `setpts=${speedRatio.toFixed(6)}*PTS` : null;

    const audioDuckingFilter = `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.5[a1]`;
    let filterStr = audioDuckingFilter;
    if (videoFilter) {
      filterStr = `[0:v]${videoFilter}[vout];` + audioDuckingFilter;
    }

    const ff = ffmpeg(videoPath).input(audioPath);

    ff.outputOptions([
        '-filter_complex', filterStr,
        '-c:v',  applyStretch ? 'libx264' : 'copy',
        ...(applyStretch ? ['-preset', 'ultrafast', '-crf', '28'] : []),
        '-c:a',  'aac',
        '-b:a',  '128k',
        '-map',  videoFilter ? '[vout]' : '0:v',
        '-map',  '[a1]',
        '-t',    options.videoDurationSec.toFixed(3),
        '-map_metadata', '-1',
        '-movflags', '+faststart',
      ])
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('stderr', (line: string) => {
        if (line.includes('Error') || line.includes('fail')) {
          console.error(`[FFmpeg Merge] ${line}`);
        }
      })
      .on('error', (err: any) => {
        console.error(`[FFmpeg Merge Error] ${err.message}`);
        reject(err);
      })
      .on('end', () => resolve())
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
  runFilter,
  trimAudio,
  mergeVideoAudioSubtitles,
  mergeVideoAudio,
  concatAudioFiles,
};
