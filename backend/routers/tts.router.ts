/**
 * TTS Router — text-to-speech generation
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ttsConversions } from "../../shared/drizzle/schema";
import { ttsService, getVoiceCredits, type VoiceId } from "../src/modules/tts";
import { deductCredits, addCredits } from "./credits";
import { acquireSlot, releaseSlot } from "../jobs";
import { r2Service, r2Key } from "../src/modules/media/services/r2.service";
import { generateShortId, buildOutputFilename } from "../src/modules/_core/filename";
import { generateSignedDownloadUrl } from "../_core/signedUrl";

// All valid voice IDs derived from actual voice definitions
import { ALL_VOICES } from "../src/modules/tts/voices";
const ALL_VOICE_IDS = Object.keys(ALL_VOICES) as [string, ...string[]];

export const ttsRouter = t.router({
  generateAudio: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1, "Invalid text").max(30000, "Text too long"),
        voice: z.enum(ALL_VOICE_IDS).optional().default("thiha"),
        speed: z.number().optional().default(1.0),
        tone: z.number().optional().default(0),
        aspectRatio: z.enum(["9:16", "16:9"]).optional().default("16:9"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const voiceId = input.voice as VoiceId;
      const rate = input.speed;
      const pitch = input.tone;
      const aspectRatio = input.aspectRatio;

      const creditsNeeded = getVoiceCredits(voiceId);
      const userId = ctx.user!.userId;

      await acquireSlot();
      let result;
      let creditsDeducted = false;
      try {
        const deducted = await deductCredits(
          userId,
          creditsNeeded,
          "tts",
          `TTS: ${voiceId}`
        );
        if (!deducted) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to deduct credits. Please try again."
          });
        }
        creditsDeducted = true;

        result = await ttsService.generateSpeech(
          input.text,
          voiceId,
          rate,
          pitch,
          aspectRatio
        );
      } catch (error: any) {
        console.error("[TTS Error]", error?.message || error);
        // Record failed conversion for analytics
        try {
          const db = await getDb();
          if (db) {
            await db.insert(ttsConversions).values({
              id: randomUUID(),
              userId,
              voice: voiceId,
              character: null,
              text: input.text.slice(0, 500),
              charCount: input.text.length,
              durationMs: 0,
              credits: creditsNeeded,
              feature: "tts",
              status: "fail",
              errorMsg: (error?.message || "TTS generation failed").slice(0, 490),
            });
          }
        } catch (dbErr) {
          console.error("[TTS DB Log Error]", dbErr);
        }
        if (creditsDeducted && error.code !== "BAD_REQUEST" && error.code !== "NOT_FOUND") {
          await addCredits(userId, creditsNeeded, "tts_refund", `Refund: ${voiceId} TTS failed`);
        }
        console.error("[TTS] Generation failed:", error);
        throw error.code === "BAD_REQUEST" || error.code === "NOT_FOUND"
          ? error
          : new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to generate audio. Please try again.",
            });
      } finally {
        releaseSlot();
      }

      if (!result || !result.audioBuffer || result.audioBuffer.length === 0) {
        console.error("[TTS Error] Empty audio buffer returned");
        // Record empty-result failure
        try {
          const db = await getDb();
          if (db) {
            await db.insert(ttsConversions).values({
              id: randomUUID(),
              userId,
              voice: voiceId,
              character: null,
              text: input.text.slice(0, 500),
              charCount: input.text.length,
              durationMs: 0,
              credits: creditsNeeded,
              feature: "tts",
              status: "fail",
              errorMsg: "Empty audio buffer",
            });
          }
        } catch (dbErr) {
          console.error("[TTS DB Log Error]", dbErr);
        }
        await addCredits(userId, creditsNeeded, "tts_refund", `Refund: ${voiceId} TTS empty result`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate audio.",
        });
      }

      // Record successful conversion
      try {
        const db = await getDb();
        if (db) {
          await db.insert(ttsConversions).values({
            id: randomUUID(),
            userId,
            voice: voiceId,
            character: null,
            text: input.text.slice(0, 500),
            charCount: input.text.length,
            durationMs: result.durationMs,
            credits: creditsNeeded,
            feature: "tts",
            status: "success",
          });
        }
      } catch (e) {
        console.error("[TTS DB Log Error]", e);
      }

      // Optionally upload to R2 with clean naming
      const shortId = generateShortId();
      let audioUrl: string | undefined;
      let srtUrl: string | undefined;

      if (r2Service.isEnabled()) {
        try {
          const audioFilename = buildOutputFilename(shortId, "TTS", "mp3");
          const audioKey = r2Key("audio", audioFilename, userId);
          await r2Service.uploadFile(audioKey, result.audioBuffer, "audio/mpeg");
          audioUrl = await generateSignedDownloadUrl(audioFilename, userId, "audio");

          if (result.srtContent) {
            const srtFilename = buildOutputFilename(shortId, "SRT", "srt");
            const srtKey = r2Key("subtitle", srtFilename, userId);
            await r2Service.uploadFile(srtKey, Buffer.from(result.srtContent, "utf-8"), "text/plain; charset=utf-8");
            srtUrl = await generateSignedDownloadUrl(srtFilename, userId, "subtitle");
          }
        } catch (r2Err) {
          console.error("[TTS] R2 upload failed:", r2Err);
        }
      }

      return {
        success: true,
        audioBase64: result.audioBuffer.toString("base64"),
        mimeType: "audio/mpeg",
        durationMs: result.durationMs,
        srtContent: result.srtContent,
        audioUrl,
        srtUrl,
        shortId,
      };
    }),
});
