import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNELS    = 1;
const AUDIO_BITRATE     = '128k';

const needsSpeedChange = (ratio: number) => Math.abs(ratio - 1.0) > 0.005;

function buildAtempoChain(ratio: number): string {
  if (ratio <= 0) return '';
  const filters: string[] = [];
  let remaining = ratio;
  while (remaining > 2.0) { filters.push('atempo=2.0'); remaining /= 2.0; }
  while (remaining < 0.5) { filters.push('atempo=0.5'); remaining /= 0.5; }
  if (remaining !== 1.0) filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters.join(',');
}

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
      .on('end', async () => { await fs.unlink(listPath).catch(() => {}); resolve(); })
      .on('error', async (err: any) => { await fs.unlink(listPath).catch(() => {}); reject(new Error(`Concat failed: ${err.message}`)); })
      .save(outputPath);
  });
}

/* ── NEW: per-file video segment extraction ── */

export async function extractVideoSegment(
  videoPath: string,
  startSec: number,
  endSec: number,
  outputPath: string,
  speedRatio?: number
): Promise<void> {
  const durationSec = endSec - startSec;
  const targetDurationStr = (speedRatio ? durationSec / speedRatio : durationSec).toFixed(3);

  return new Promise((resolve, reject) => {
    const ff = ffmpeg(videoPath)
      .seekInput(parseFloat(startSec.toFixed(6)))
      .duration(parseFloat(durationSec.toFixed(6)));

    const videoFilters: string[] = [];
    if (speedRatio && needsSpeedChange(speedRatio)) {
      videoFilters.push(`setpts=PTS/${speedRatio.toFixed(6)}`);
    }
    videoFilters.push('fps=30');

    if (videoFilters.length > 0) ff.videoFilters(videoFilters.join(','));

    ff.outputOptions([
      '-r',         '30',
      '-vsync',     'cfr',
      '-t',         targetDurationStr,
      '-c:v',       'libx264',
      '-preset',    'fast',
      '-crf',       '23',
      '-an',
      '-movflags',  '+faststart',
    ])
    .on('end', () => resolve())
    .on('error', reject)
    .save(outputPath);
  });
}

export async function concatVideoFiles(videoParts: string[], outputPath: string): Promise<void> {
  if (videoParts.length === 0) throw new Error("No video parts to concatenate");
  const listPath = outputPath + '.concat_list.txt';
  const lines = videoParts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, lines);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v',    'libx264',
        '-preset', 'fast',
        '-crf',    '23',
        '-an',
        '-movflags', '+faststart',
      ])
      .on('end', async () => { await fs.unlink(listPath).catch(() => {}); resolve(); })
      .on('error', async (err: any) => { await fs.unlink(listPath).catch(() => {}); reject(new Error(`Video concat failed: ${err.message}`)); })
      .save(outputPath);
  });
}

export async function adjustAudioSpeed(
  inputPath: string,
  outputPath: string,
  speedRatio: number
): Promise<void> {
  if (!needsSpeedChange(speedRatio)) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }
  const filter = buildAtempoChain(speedRatio);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filter)
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export async function mergeDubbedVideoSimple(
  processedVideoPath: string,
  ttsTrackPath: string,
  outputPath: string,
  options?: {
    subtitlesPath?: string;
    fontPath?: string;
    onProgress?: (progress: number) => void;
  }
): Promise<void> {
  const ff = ffmpeg(processedVideoPath)
    .input(ttsTrackPath);

  const outputOpts = [
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
  ];

  if (options?.subtitlesPath) {
    let subFilter: string;
    if (options.fontPath) {
      const p  = options.subtitlesPath.replace(/\\/g, '/');
      const fd = path.dirname(options.fontPath).replace(/\\/g, '/');
      const ep = p.replace(/:/g, '\\:');
      if (process.platform !== 'win32' && fd.startsWith('/usr/share/fonts')) {
        subFilter = `ass='${ep}'`;
      } else {
        subFilter = `ass='${ep}':fontsdir='${fd.replace(/:/g, '\\:')}'`;
      }
    } else {
      subFilter = `subtitles='${options.subtitlesPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`;
    }
    outputOpts.push('-vf', subFilter);
  }

  return new Promise((resolve, reject) => {
    ff.outputOptions(outputOpts)
    .on('progress', (p: any) => options?.onProgress?.(p.percent ?? 0))
    .on('error', reject)
    .on('end',   resolve)
    .save(outputPath);
  });
}

export const ffmpegService = {
  getVideoDuration,
  getAudioDurationMs,
  getVideoSize,
  extractAudio,
  generateSilenceWav,
  convertToWav,
  trimSilenceWav,
  concatAudioFiles,
  extractVideoSegment,
  concatVideoFiles,
  adjustAudioSpeed,
  mergeDubbedVideoSimple,
};
