import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNELS    = 1;
const AUDIO_BITRATE     = '128k';

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

export async function getVideoMetadata(filePath: string): Promise<{ hasAudio: boolean; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) reject(err);
      else {
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
        const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');
        resolve({
          hasAudio: !!audioStream,
          width:  videoStream?.width  || 1920,
          height: videoStream?.height || 1080,
          duration: metadata.format.duration || 0,
        });
      }
    });
  });
}

export async function getVideoSize(filePath: string): Promise<{ width: number; height: number }> {
  const meta = await getVideoMetadata(filePath);
  return { width: meta.width, height: meta.height };
}

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

export async function generateSilenceWav(durationMs: number, outputPath: string): Promise<void> {
  if (durationMs <= 0) return;
  const durationSec = (durationMs / 1000).toFixed(6);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=mono`)
      .inputFormat('lavfi')
      .duration(parseFloat(durationSec))
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export async function speedUpAudioWav(
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
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Trim leading/trailing silence from a WAV file, outputting WAV.
 */
export async function trimSilenceWav(
  inputPath: string,
  outputPath: string,
  thresholdDb = -55,
  minSilenceSec = 0.05
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(
        `silenceremove=start_periods=1:start_duration=${minSilenceSec}:start_threshold=${thresholdDb}dB:` +
        `stop_periods=1:stop_duration=${minSilenceSec}:stop_threshold=${thresholdDb}dB`
      )
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

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

export async function concatAudioFiles(audioParts: string[], outputPath: string): Promise<void> {
  if (audioParts.length === 0) throw new Error("No audio parts to concatenate");

  const listPath = outputPath + '.concat_list.txt';
  const lines = audioParts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, lines);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', async () => {
        await fs.unlink(listPath).catch(() => {});
        resolve();
      })
      .on('error', async (err: any) => {
        await fs.unlink(listPath).catch(() => {});
        reject(new Error(`Concat failed: ${err.message}`));
      })
      .save(outputPath);
  });
}

export interface VideoPart {
  type: 'intro' | 'speech' | 'gap' | 'outro';
  startSec: number;
  endSec: number;
  speedRatio: number;  // 1.0 for non-speech, >1 = slow down, <1 = speed up
  outputDurationMs: number;
  segmentIndex?: number;
}

/**
 * Build a single filter_complex that produces the full warped video.
 * Includes intro, speech segments, gaps, and outro.
 * Every part is trimmed and concatenated. Speech segments get setpts warping.
 */
function buildFullVideoFilter(parts: VideoPart[], subFilter?: string): string {
  const filterLines: string[] = [];
  const labels: string[] = [];

  parts.forEach((part, i) => {
    const start = part.startSec.toFixed(6);
    const end   = part.endSec.toFixed(6);
    const label = `p${i}`;

    if (part.type === 'speech' && needsSpeedChange(part.speedRatio)) {
      const ratio = part.speedRatio.toFixed(6);
      filterLines.push(`[0:v]trim=start=${start}:end=${end},setpts=(PTS-STARTPTS)*${ratio}[${label}]`);
    } else {
      filterLines.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[${label}]`);
    }
    labels.push(`[${label}]`);
  });

  const concatOut = subFilter ? `vconcat` : `vout`;
  filterLines.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[${concatOut}]`);

  if (subFilter) {
    filterLines.push(`[vconcat]${subFilter}[vout]`);
  }

  return filterLines.join(';');
}

export async function mergeWarpedVideoWithAudioAndSubs(
  videoPath: string,
  audioPath: string,
  subtitlesPath: string | null,
  outputPath: string,
  options: {
    videoParts: VideoPart[];
    exactAudioDurationSec: number;
    fontPath?: string;
    onProgress?: (progress: number) => void;
  }
): Promise<void> {
  // Build subtitle filter
  let subFilter: string | null = null;
  if (subtitlesPath) {
    if (options.fontPath) {
      const p  = subtitlesPath.replace(/\\/g, '/');
      const fd = path.dirname(options.fontPath).replace(/\\/g, '/');
      const ep = p.replace(/:/g, '\\:');
      if (process.platform !== 'win32' && fd.startsWith('/usr/share/fonts')) {
        subFilter = `ass='${ep}'`;
      } else {
        subFilter = `ass='${ep}':fontsdir='${fd.replace(/:/g, '\\:')}'`;
      }
    } else {
      subFilter = `subtitles='${subtitlesPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`;
    }
  }

  const filterComplex = buildFullVideoFilter(options.videoParts, subFilter || undefined);

  return new Promise((resolve, reject) => {
    const ff = ffmpeg(videoPath).input(audioPath);

    const outputOpts = [
      '-filter_complex', filterComplex,
      '-map',    '[vout]',
      '-map',    '1:a',
      '-c:v',    'libx264',
      '-preset', 'fast',
      '-crf',    '23',
      '-c:a',    'aac',
      '-b:a',    '128k',
      '-shortest',
      '-map_metadata', '-1',
      '-movflags', '+faststart',
    ];

    ff.outputOptions(outputOpts)
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('error', reject)
      .on('end',   resolve)
      .save(outputPath);
  });
}

export async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav' && inputPath === outputPath) return;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export const ffmpegService = {
  getVideoDuration,
  getAudioDurationMs,
  getVideoMetadata,
  getVideoSize,
  extractAudio,
  generateSilenceWav,
  speedUpAudioWav,
  trimSilenceWav,
  runFilter,
  concatAudioFiles,
  mergeWarpedVideoWithAudioAndSubs,
  convertToWav,
};
