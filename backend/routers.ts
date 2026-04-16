import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes, randomUUID } from "crypto";
import { generateSpeech, SUPPORTED_VOICES } from "./tts";
import { dubVideoFromBuffer, dubVideoFromLink } from "./videoDubber";
import { isAllowedVideoUrl } from "./_core/security";

const t = initTRPC.create();

export const appRouter = t.router({
  tts: t.router({
    generateAudio: t.procedure
      .input(
        z.object({
          text: z.string(),
          voice: z.enum(["thiha", "nilar"]).optional(),
          rate: z.number().optional(),
          pitch: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await generateSpeech(
            input.text,
            input.voice,
            input.rate,
            input.pitch
          );
          return {
            audioUrl: "data:audio/mp3;base64," + result.audioBuffer.toString("base64"),
            srtContent: result.srtContent,
          };
        } catch (error) {
          console.error("[TTS Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio. Please try again.",
          });
        }
      }),
  }),
  dub: t.router({
    fromLink: t.procedure
      .input(
        z.object({
          url: z.string(),
          voice: z.enum(["thiha", "nilar"]),
          speed: z.number().optional(),
          pitch: z.number().optional(),
          srtEnabled: z.boolean().optional(),
          userApiKey: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await dubVideoFromLink(input.url, {
            voice: input.voice,
            speed: input.speed ?? 1.0,
            pitch: input.pitch ?? 0,
            srtEnabled: input.srtEnabled ?? true,
            userApiKey: input.userApiKey,
          });
        } catch (error: any) {
          console.error("[Dub Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to dub video.",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
