/**
 * Dub Router Ã¢â‚¬â€ legacy video dubbing from link
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { dubVideoPipeline } from "../src/modules/dubbing/pipelines/dubVideo.pipeline";
import { isAllowedVideoUrl } from "../_core/security";
import { deductCredits, addCredits } from "./credits";

export const dubRouter = t.router({
  fromLink: protectedProcedure
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
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL. YouTube, TikTok, Facebook only.",
        });
      }

      await deductCredits(userId, 10, "video_dub", `Legacy Video Dub Link: ${input.voice}`);

      try {
        return await dubVideoPipeline.executeFromLink(input.url, {
          voice: input.voice,
          speed: input.speed ?? 1.0,
          pitch: input.pitch ?? 0,
          srtEnabled: input.srtEnabled ?? true,
          userApiKey: input.userApiKey,
        });
      } catch (error: any) {
        console.error("[Dub Error]", error);
        await addCredits(userId, 10, "video_dub_refund", "Refund: Dub link pipeline failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to dub video.",
        });
      }
    }),
});
