/**
 * TTS Router — text-to-speech generation
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ttsConversions } from "../../drizzle/schema";
import { ttsService, getVoiceCredits, type VoiceId } from "../src/modules/tts";
import { deductCredits, addCredits } from "./credits";
import { acquireSlot, releaseSlot } from "../jobs";

// All valid voice IDs for validation
const ALL_VOICE_IDS = [
  // Tier 1
  "thiha", "nilar",
  // Tier 2
  "ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara",
  // Tier 3
  "gemini_alex", "gemini_aria", "gemini_asha", "gemini_b中年", "gemini_dustin", "gemini_emma",
  "gemini_eric", "gemini_female_01", "gemini_female_02", "gemini_kokoro", "gemini_male_01",
  "gemini_male_02", "gemini_male_03", "gemini_puck", "gemini_soren", "gemini_studio_female",
  "gemini_studio_male",
] as const;

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
      try {
        await deductCredits(
          userId,
          creditsNeeded,
          "tts",
          `TTS: ${voiceId}`
        );

        result = await ttsService.generateSpeech(
          input.text,
          voiceId,
          rate,
          pitch,
          aspectRatio
        );
      } catch (error: any) {
        console.error("[TTS Error]", error?.message || error);
        if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") {
          releaseSlot();
          throw error;
        }
        await addCredits(userId, creditsNeeded, "tts_refund", `Refund: ${voiceId} TTS failed`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to generate audio.",
        });
      } finally {
        releaseSlot();
      }

      if (!result || !result.audioBuffer || result.audioBuffer.length === 0) {
        console.error("[TTS Error] Empty audio buffer returned");
        await addCredits(userId, creditsNeeded, "tts_refund", `Refund: ${voiceId} TTS empty result`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate audio.",
        });
      }

      // Record conversion
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
          });
        }
      } catch (e) {
        console.error("[TTS DB Log Error]", e);
      }

      return {
        success: true,
        audioBase64: result.audioBuffer.toString("base64"),
        mimeType: "audio/mpeg",
        durationMs: result.durationMs,
        srtContent: result.srtContent,
      };
    }),
});
