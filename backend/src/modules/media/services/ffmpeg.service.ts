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
 * Operating in WAV domain avoids MP3 encoder-delay/padding artifacts
 * that create micro-gaps at segment boundaries.
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
  // All inputs must be same-format WAV (44100Hz, mono, pcm_s16le).
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
      .save(outputPath);
  });
}

export interface VideoSegmentWarp {
  origStartSec:    number;
  origEndSec:      number;
  speedRatio:      number;  // < 1 = slow down, > 1 = speed up
  newDurationSec:  number;
}

/**
 * Process each video segment as a separate file with setpts, then concatenate.
 * This is MUCH more reliable than filter_complex because -t works on individual
 * files (it truncates decoded output, not input).
 *
 * Each segment is extracted, stretched with setpts, and saved as a temp MP4.
 * Then all temp MP4s are concatenated with the concat demuxer.
 */
export async function processVideoSegments(
  videoPath: string,
  segments: VideoSegmentWarp[],
  tempDir: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const segmentFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const start = seg.origStartSec.toFixed(6);
    const duration = (seg.origEndSec - seg.origStartSec).toFixed(6);
    const ratio = seg.speedRatio.toFixed(6);
    const outPath = path.join(tempDir, `vid_seg_${i}.mp4`);

    // Use -ss + -t on input (fast seek) + setpts filter for speed change
    // -t truncates decoded output to exactly the target duration
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(parseFloat(start))
        .duration(parseFloat(duration))
        .videoFilters(`setpts=(PTS-STARTPTS)*${ratio}`)
        .outputOptions([
          '-c:v',    'libx264',
          '-preset', 'fast',
          '-crf',    '23',
          '-an',
          '-t',      seg.newDurationSec.toFixed(6),  // Force exact output duration
          '-movflags', '+faststart',
        ])
        .on('end', () => {
          onProgress?.(Math.round(((i + 1) / segments.length) * 100));
          resolve();
        })
        .on('error', reject)
        .save(outPath);
    });

    segmentFiles.push(outPath);
    console.log(`[FFmpeg VideoSegment] seg ${i}: orig=${start}s duration=${duration}s ratio=${ratio} → ${outPath}`);
  }

  // Concatenate all segment files
  const concatList = path.join(tempDir, 'video_concat_list.txt');
  const concatLines = segmentFiles.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(concatList, concatLines);

  const outputPath = path.join(tempDir, 'warped_video.mp4');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatList)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v',    'copy',
        '-an',
        '-movflags', '+faststart',
      ])
      .on('end', async () => {
        await fs.unlink(concatList).catch(() => {});
        console.log(`[FFmpeg VideoConcat] Done → ${outputPath}`);
        resolve();
      })
      .on('error', async (err: any) => {
        await fs.unlink(concatList).catch(() => {});
        reject(new Error(`Video concat failed: ${err.message}`));
      })
      .save(outputPath);
  });

  return outputPath;
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
    tempDir:              string;
    onProgress?:          (progress: number) => void;
  }
): Promise<void> {
  // Step 1: Process video segments into a warped video file
  const warpedVideoPath = await processVideoSegments(
    videoPath,
    options.videoSegments,
    options.tempDir,
    options.onProgress,
  );

  // Step 2: Build subtitle filter
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

  // Step 3: Merge warped video + audio + subtitles
  return new Promise((resolve, reject) => {
    ffmpeg(warpedVideoPath)
      .input(audioPath)
      .outputOptions([
        '-vf',       subFilter,
        '-c:v',      'libx264',
        '-preset',   'fast',
        '-crf',      '23',
        '-c:a',      'aac',
        '-b:a',      '128k',
        '-t',        options.totalAudioDurationSec.toFixed(6),
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
    tempDir:               string;
    onProgress?:           (progress: number) => void;
  }
): Promise<void> {
  // Step 1: Process video segments into a warped video file
  const warpedVideoPath = await processVideoSegments(
    videoPath,
    options.videoSegments,
    options.tempDir,
    options.onProgress,
  );

  // Step 2: Merge warped video + audio
  return new Promise((resolve, reject) => {
    ffmpeg(warpedVideoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v',      'libx264',
        '-preset',   'fast',
        '-crf',      '23',
        '-c:a',      'aac',
        '-b:a',      '128k',
        '-t',        options.totalAudioDurationSec.toFixed(6),
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
  trimSilenceWav,
  runFilter,
  trimAudio,
  mergeVideoAudioSubtitles,
  mergeVideoAudio,
  mergeVideoAudioSubtitlesPerSegment,
  mergeVideoAudioPerSegment,
  processVideoSegments,
  concatAudioFiles,
  convertToWav,
};
