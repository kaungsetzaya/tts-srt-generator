import type { DubbingInput, DubbingOutput } from "./types";
import { whisper } from "../translation/services/whisper";
import { translateSegments } from "../translation/services/gemini";
import { edgeTts } from "../tts/services/edgeTts";
import { media } from "../media/services/ffmpeg";
import { buildAssSubtitle } from "./services/assBuilder";

// ═══════════════════════════════════════════════════════════════
// Dubbing Pipeline (FULL)
// Input: video + voice + subtitle options → Output: dubbed video
// Reuses translation.service (NOT translation.pipeline)
// ═══════════════════════════════════════════════════════════════

export class DubbingPipeline {
  async process(input: DubbingInput): Promise<DubbingOutput> {
    const { videoBuffer, options, userApiKey } = input;

    // Step 1: Extract audio from video
    const audioBuffer = await media.extractAudio(videoBuffer, "mp3");

    // Step 2: Transcribe with Whisper (get timestamps)
    const whisperResult = await whisper.transcribe(audioBuffer);

    if (!whisperResult.segments.length) {
      throw new Error("No speech detected in video");
    }

    // Step 3: Translate segments (batched, preserves timestamps)
    // Uses gemini service directly, NOT translation pipeline
    const translatedSegments = await translateSegments(whisperResult.segments);

    // Step 4: Generate TTS per segment
    const ttsAudioBuffers: Buffer[] = [];
    for (const seg of translatedSegments) {
      const ttsResult = await edgeTts.generate({
        text: seg.translatedText,
        options: { voice: options.voice, speed: 1.2, pitch: 0 },
      });
      ttsAudioBuffers.push(ttsResult.audio.audioBuffer);
    }

    // Step 5: Concatenate TTS audio segments
    const finalAudio = await media.concatAudio(ttsAudioBuffers, "mp3");

    // Step 6: Generate ASS subtitles if enabled
    let assContent: string | undefined;
    if (options.srtEnabled) {
      assContent = buildAssSubtitle(translatedSegments);
    }

    // Step 7: Merge audio with video
    const finalVideo = await media.merge(videoBuffer, finalAudio, assContent);

    // Calculate total TTS duration from segments
    const totalDuration = translatedSegments.reduce((sum, seg) => {
      return sum + (seg.end - seg.start) * 1000; // Convert seconds to ms
    }, 0);

    // Build combined Myanmar text from all translated segments
    const myanmarText = translatedSegments.map(seg => seg.translatedText).join(" ");

    return {
      videoBuffer: finalVideo,
      srtContent: assContent,
      durationMs: totalDuration || 0,
      myanmarText,
    };
  }
}

export const dubbingPipeline = new DubbingPipeline();