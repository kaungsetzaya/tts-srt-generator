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
      .input(`anoisesrc=r=${AUDIO_SAMPLE_RATE}:d=${durationSec}:c=white:a=0.00005`)
      .inputFormat('lavfi')
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export async function padAudioWithSilence(
  inputPath: string,
  outputPath: string,
  targetDurationMs: number
): Promise<void> {
  const inputDurationMs = await getAudioDurationMs(inputPath);
  const padMs = targetDurationMs - inputDurationMs;
  if (padMs <= 0) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }
  const silencePath = outputPath + '.silence.wav';
  await generateSilenceWav(padMs, silencePath);
  return concatAudioFiles([inputPath, silencePath], outputPath);
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

export async function extractVideoSegment(
  videoPath: string,
  startSec: number,
  endSec: number,
  outputPath: string,
  targetDurationMs?: number  // ← TTS duration ပေးမယ်
): Promise<void> {
  const srcDuration = endSec - startSec;
  const targetDuration = targetDurationMs ? targetDurationMs / 1000 : srcDuration;
  const speedRatio = srcDuration / targetDuration; // <1 = slowdown, >1 = speedup

  const MAX_VIDEO_SPEED = 2.0;
  const MIN_VIDEO_SPEED = 0.5;
  const clampedRatio = Math.max(MIN_VIDEO_SPEED, Math.min(MAX_VIDEO_SPEED, speedRatio));

  return new Promise((resolve, reject) => {
    const ff = ffmpeg(videoPath)
      .seekInput(parseFloat(startSec.toFixed(6)))
      .duration(parseFloat(srcDuration.toFixed(6)));

    const videoFilters: string[] = [];
    if (Math.abs(clampedRatio - 1.0) > 0.01) {
      videoFilters.push(`setpts=${(1 / clampedRatio).toFixed(6)}*PTS`);
    }
    videoFilters.push('fps=30');

    ff.videoFilters(videoFilters.join(','))
      .outputOptions([
        '-r', '30',
        '-vsync', 'cfr',
        '-t', targetDuration.toFixed(6),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-an',
        '-movflags', '+faststart',
      ])
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export async function concatVideoFiles(videoParts: string[], outputPath: string): Promise<void> {
  if (videoParts.length === 0) throw new Error('No video parts to concatenate');
  const listPath = outputPath + '.vconcat_list.txt';
  const lines = videoParts.map(p => `file '${p.replace(/'/g, "'\\''")}' `).join('\n');
  await fs.writeFile(listPath, lines);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', '30',
        '-pix_fmt', 'yuv420p',
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
  ratio: number
): Promise<void> {
  if (!needsSpeedChange(ratio)) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }
  const chain = buildAtempoChain(ratio);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(chain)
      .audioCodec('pcm_s16le')
      .audioFrequency(AUDIO_SAMPLE_RATE)
      .audioChannels(AUDIO_CHANNELS)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export async function extractVideoOnly(
  videoPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noAudio()
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', '30',
        '-pix_fmt', 'yuv420p',
      ])
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

export async function extractAndWarpVideoSegment(
  videoPath: string,
  startSec: number,
  endSec: number,
  targetDurationMs: number,
  outputPath: string
): Promise<void> {
  const originalDurationSec = endSec - startSec;
  const targetDurationSec = targetDurationMs / 1000;
  
  // Always warp to ensure precise duration matching, even if ratio is close to 1
  const ratio = targetDurationSec / originalDurationSec;
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(parseFloat(startSec.toFixed(6)))
      .duration(parseFloat(originalDurationSec.toFixed(6)))
      .outputOptions([
        '-vf', `setpts=${ratio.toFixed(6)}*PTS`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', '30', // Force same frame rate as extractVideoSegment
        '-pix_fmt', 'yuv420p',
        '-an',
        '-movflags', '+faststart',
      ])
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
    backgroundAudioPath?: string;
    onProgress?: (progress: number) => void;
  }
): Promise<void> {
  const outputOpts: string[] = [
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    // ← '-shortest' ဖြုတ်လိုက်တယ်
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
    let command = ffmpeg(processedVideoPath).input(ttsTrackPath);

    if (options?.backgroundAudioPath) {
      command = command.input(options.backgroundAudioPath)
        .complexFilter([
          '[1:a]volume=1.0[voice]',
          '[2:a]volume=0.15[bg]',
          '[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[a]'
        ])
        .outputOptions(['-map', '0:v:0', '-map', '[a]']);
    } else {
      command = command.outputOptions(['-map', '0:v:0', '-map', '1:a:0']);
    }

    command
      .outputOptions(outputOpts)
      .on('progress', (p: any) => options?.onProgress?.(p.percent ?? 0))
      .on('error', (err) => {
        console.error('[FFMPEG MERGE ERROR]', err);
        reject(err);
      })
      .on('end', () => resolve())
      .save(outputPath);
  });
}

export async function trimAudioToduration(
  inputPath: string,
  outputPath: string,
  targetDurationMs: number
): Promise<void> {
  const targetSec = (targetDurationMs / 1000).toFixed(6);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .duration(parseFloat(targetSec))
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
  getVideoSize,
  extractAudio,
  generateSilenceWav,
  padAudioWithSilence,
  convertToWav,
  trimSilenceWav,
  concatAudioFiles,
  extractVideoSegment,
  extractAndWarpVideoSegment,
  concatVideoFiles,
  adjustAudioSpeed,
  extractVideoOnly,
  mergeDubbedVideoSimple,
  trimAudioToduration,
};

