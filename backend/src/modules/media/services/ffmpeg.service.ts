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

export async function concatAudioFiles(audioParts: string[], outputPath: string): Promise<void> {
  // Use ffmpeg concat demuxer with re-encode to guarantee sample-accurate timing.
  // Raw MP3 buffer concatenation silently drifts because MP3 frames have
  // encoder-delay and padding that accumulate across joins. Using the concat
  // demuxer + pcm_s16le output eliminates that drift.
  if (audioParts.length === 0) throw new Error("No audio parts to concatenate");

  // Build a concat list file
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
        console.log(`[FFmpeg Concat] Sample-accurate concat done → ${outputPath}`);
        resolve();
      })
      .on('error', async (err: any) => {
        await fs.unlink(listPath).catch(() => {});
        reject(new Error(`Concat failed: ${err.message}`));
      })
      .save(outputPath.replace(/\.mp3$/, '.wav'));
  });
}

export interface VideoSegmentWarp {
  origStartSec:    number;
  origEndSec:      number;
  speedRatio:      number;  // < 1 = slow down, > 1 = speed up
  newDurationSec:  number;
}

/**
 * Build a filter_complex string that warps each video segment independently.
 * Each segment is trimmed from the original, its PTS scaled (setpts), then
 * all segments are concatenated. The result perfectly matches the audio timeline.
 *
 * setpts formula: PTS = (PTS - STARTPTS) * speedRatio / TB  but we use the
 * simpler form: setpts=(PTS-STARTPTS)*ratio which works because concat resets PTS.
 */
function buildPerSegmentVideoFilter(
  segments: VideoSegmentWarp[],
  _videoDurationSec: number,
  subFilter?: string
): string {
  const parts: string[] = [];
  const labels: string[] = [];

  segments.forEach((seg, i) => {
    const start = seg.origStartSec.toFixed(6);
    const end   = seg.origEndSec.toFixed(6);
    const ratio = seg.speedRatio.toFixed(6);
    const label = `v${i}`;

    // trim → setpts to warp speed → apply subtitles on last step
    parts.push(`[0:v]trim=start=${start}:end=${end},setpts=(PTS-STARTPTS)*${ratio}[${label}]`);
    labels.push(`[${label}]`);
  });

  // Only include speech segments — no intro/outro.
  // This guarantees video duration == audio duration exactly.
  const n = labels.length;
  const concatOut = subFilter ? `vconcat` : `vout`;
  parts.push(`${labels.join('')}concat=n=${n}:v=1:a=0[${concatOut}]`);

  if (subFilter) {
    parts.push(`[vconcat]${subFilter}[vout]`);
  }

  return parts.join(';');
}

export async function mergeVideoAudioSubtitlesPerSegment(
  videoPath:     string,
  audioPath:     string,
  subtitlesPath: string,
  outputPath:    string,
  options: {
    videoSegments:        VideoSegmentWarp[];
    totalAudioDurationSec: number;
    videoDurationSec:     number;
    fontPath?:            string;
    onProgress?:          (progress: number) => void;
  }
): Promise<void> {
  // Build subtitle filter
  let subFilter: string;
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

  const filterComplex = buildPerSegmentVideoFilter(
    options.videoSegments,
    options.videoDurationSec,
    subFilter
  );

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        '-filter_complex', filterComplex,
        '-map',    '[vout]',
        '-map',    '1:a',
        '-c:v',    'libx264',
        '-preset', 'fast',
        '-crf',    '23',
        '-c:a',    'aac',
        '-b:a',    '128k',
        '-t',      options.totalAudioDurationSec.toFixed(3),
        '-map_metadata', '-1',
        '-movflags', '+faststart',
      ])
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('error', reject)
      .on('end',   resolve)
      .save(outputPath);
  });
}

export async function mergeVideoAudioPerSegment(
  videoPath:  string,
  audioPath:  string,
  outputPath: string,
  options: {
    videoSegments:         VideoSegmentWarp[];
    totalAudioDurationSec: number;
    videoDurationSec:      number;
    onProgress?:           (progress: number) => void;
  }
): Promise<void> {
  const filterComplex = buildPerSegmentVideoFilter(
    options.videoSegments,
    options.videoDurationSec
  );

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        '-filter_complex', filterComplex,
        '-map',    '[vout]',
        '-map',    '1:a',
        '-c:v',    'libx264',
        '-preset', 'fast',
        '-crf',    '23',
        '-c:a',    'aac',
        '-b:a',    '128k',
        '-t',      options.totalAudioDurationSec.toFixed(3),
        '-map_metadata', '-1',
        '-movflags', '+faststart',
      ])
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('error', reject)
      .on('end',   resolve)
      .save(outputPath);
  });
}

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

    const speedRatio  = options.videoSpeedRatio ?? 1.0;
    const applyStretch = needsSpeedChange(speedRatio);
    const videoFilter = applyStretch ? `${subFilter},setpts=${speedRatio.toFixed(6)}*PTS` : subFilter;

    const filterStr = `[0:v]${videoFilter}[vout]`;

    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        '-filter_complex', filterStr,
        '-c:v',        'libx264',
        '-preset',     'ultrafast',
        '-crf',        '28',
        '-c:a',        'aac',
        '-b:a',        '128k',
        '-map',        '[vout]',
        '-map',        '1:a',
        '-t',          options.videoDurationSec.toFixed(3),
        '-map_metadata', '-1',
        '-movflags',   '+faststart',
      ])
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}

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

    const filterStr = videoFilter ? `[0:v]${videoFilter}[vout]` : null;

    const ff = ffmpeg(videoPath).input(audioPath);

    ff.outputOptions([
        '-filter_complex', filterStr || '[0:v]copy[vout]',
        '-c:v',  applyStretch ? 'libx264' : 'copy',
        ...(applyStretch ? ['-preset', 'ultrafast', '-crf', '28'] : []),
        '-c:a',  'aac',
        '-b:a',  '128k',
        '-map',  videoFilter ? '[vout]' : '0:v',
        '-map',  '1:a',
        '-t',    options.videoDurationSec.toFixed(3),
        '-map_metadata', '-1',
        '-movflags', '+faststart',
      ])
      .on('progress', (p: any) => options.onProgress?.(p.percent ?? 0))
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}

export async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  // If input is already PCM WAV (from our new concatAudioFiles), skip re-encode.
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
  generateSilence,
  generateSilenceWav,
  speedUpAudio,
  speedUpAudioWav,
  runFilter,
  trimAudio,
  mergeVideoAudioSubtitles,
  mergeVideoAudio,
  mergeVideoAudioSubtitlesPerSegment,
  mergeVideoAudioPerSegment,
  concatAudioFiles,
  convertToWav,
};
