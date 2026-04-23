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
  const startStr = startSec.toFixed(6);
  const durationStr = durationSec.toFixed(6);
  const targetDurationStr = (speedRatio ? durationSec * speedRatio : durationSec).toFixed(6);

  return new Promise((resolve, reject) => {
    const ff = ffmpeg(videoPath)
      .seekInput(parseFloat(startStr))
      .duration(parseFloat(durationStr));

    const filters: string[] = [];
    if (speedRatio && needsSpeedChange(speedRatio)) {
      filters.push(`setpts=(PTS-STARTPTS)*${speedRatio.toFixed(6)}`);
    }
    if (filters.length > 0) ff.videoFilters(filters.join(','));

    ff.outputOptions([
      '-c:v',    'libx264',
      '-preset', 'fast',
      '-crf',    '23',
      '-an',
      '-t',      targetDurationStr,
      '-movflags', '+faststart',
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

export async function mergeDubbedVideo(
  processedVideoPath: string,
  originalAudioPath: string,
  ttsFiles: Array<{ path: string; startMs: number }>,
  outputPath: string,
  options?: {
    speechSegments?: Array<{ startSec: number; endSec: number }>;
    onProgress?: (progress: number) => void;
  }
): Promise<void> {
  const segments = options?.speechSegments || [];
  const totalInputs = 2 + ttsFiles.length; // video, original audio, tts files

  // Build audio filter: mute speech regions in original, delay TTS, mix all
  const audioFilters: string[] = [];

  // Original audio with speech segments muted
  if (segments.length > 0) {
    let volumeExpr = '1';
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i];
      volumeExpr = `if(between(t,${s.startSec.toFixed(3)},${s.endSec.toFixed(3)}),0.05,${volumeExpr})`;
    }
    audioFilters.push(`[1:a]volume='${volumeExpr}':eval=frame[muted]`);
  } else {
    audioFilters.push('[1:a]copy[muted]');
  }

  // Delay each TTS
  const ttsLabels: string[] = ['[muted]'];
  ttsFiles.forEach((tts, i) => {
    const delayMs = Math.max(0, tts.startMs);
    const label = `tts${i}`;
    audioFilters.push(`[${i + 2}:a]adelay=${delayMs}|${delayMs}[${label}]`);
    ttsLabels.push(`[${label}]`);
  });

  // Mix all audio
  audioFilters.push(`${ttsLabels.join('')}amix=inputs=${ttsLabels.length}:duration=longest[aout]`);

  const filterComplex = audioFilters.join(';');

  return new Promise((resolve, reject) => {
    const ff = ffmpeg(processedVideoPath).input(originalAudioPath);
    ttsFiles.forEach(t => ff.input(t.path));

    ff.outputOptions([
      '-filter_complex', filterComplex,
      '-map',    '0:v',
      '-map',    '[aout]',
      '-c:v',    'libx264',
      '-preset', 'fast',
      '-crf',    '23',
      '-c:a',    'aac',
      '-b:a',    '128k',
      '-map_metadata', '-1',
      '-movflags', '+faststart',
    ])
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
  mergeDubbedVideo,
};
