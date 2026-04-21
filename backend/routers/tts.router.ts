/**
 * TTS Router — text-to-speech generation
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ttsConversions } from "../../drizzle/schema";
import { ttsService } from "../src/modules/tts/services/tts.service";
const { generateSpeech, generateSpeechWithCharacter } = ttsService;
import { deductCredits, addCredits } from "./credits";
import { acquireSlot, releaseSlot } from "../jobs";

export const ttsRouter = t.router({
  generateAudio: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1, "Invalid text").max(30000, "Text too long"),
        voice: z.enum(["thiha", "nilar"]).optional(),
        tone: z.number().optional(),
        speed: z.number().optional(),
        aspectRatio: z.enum(["9:16", "16:9"]).optional(),
        character: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const voice = input.voice || "thiha";
      const rate = input.speed ?? 1.0;
      const pitch = input.tone ?? 0;
      const aspectRatio = input.aspectRatio || "16:9";

      const creditsNeeded = input.character ? 3 : 1;
      const userId = ctx.user!.userId;
      const voiceName = input.character || voice;

      // Acquire a slot from the centralized queue (shared with dub/translate jobs)
      // BEFORE deducting credits so users don't lose credits while waiting in queue
      await acquireSlot();
      let result;
      try {
        await deductCredits(
          userId,
          creditsNeeded,
          "tts",
          input.character
            ? `TTS Character: ${input.character}`
            : `TTS Voice: ${voice}`
        );

        if (input.character) {
          result = await generateSpeechWithCharacter(
            input.text,
            input.character as any,
            rate,
            aspectRatio,
            pitch
          );
        } else {
          result = await generateSpeech(
            input.text,
            voice,
            rate,
            pitch,
            aspectRatio
          );
        }
      } catch (error: any) {
        console.error("[TTS Error]", error?.message || error);
        if (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") {
          releaseSlot();
          throw error;
        }
        await addCredits(userId, creditsNeeded, "tts_refund", `Refund: ${voiceName} TTS failed`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to generate audio.",
        });
      } finally {
        releaseSlot();
      }

      if (!result || !result.audioBuffer || result.audioBuffer.length === 0) {
        console.error("[TTS Error] Empty audio buffer returned");
        await addCredits(userId, creditsNeeded, "tts_refund", `Refund: ${voiceName} TTS empty result`);
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
            voice,
            character: input.character || null,
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
