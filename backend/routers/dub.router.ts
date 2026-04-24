/**
 * Dub Router — video dubbing from link (async job-based)
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { isAllowedVideoUrl } from "../_core/security";
import { deductCredits, addCredits } from "./credits";
import { createJob } from "../jobs";

export const dubRouter = t.router({
  fromLink: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar"]),
        speed: z.number().optional(),
        pitch: z.number().optional(),
        srtEnabled: z.boolean().optional(),
        userApiKey: z.string().regex(/^[A-Za-z0-9_\-]{20,100}$/).optional(),
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

      const deducted = await deductCredits(userId, 10, "video_dub", `Legacy Video Dub Link: ${input.voice}`);
      if (!deducted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deduct credits. Please try again.",
        });
      }

      try {
        const jobId = createJob("dub_link", {
          url: input.url,
          voice: input.voice,
          speed: input.speed ?? 1.0,
          pitch: input.pitch ?? 0,
          srtEnabled: input.srtEnabled ?? true,
          userApiKey: input.userApiKey,
          userId,
        }, userId);

        return { jobId };
      } catch (error: any) {
        console.error("[Dub Error]", error);
        await addCredits(userId, 10, "video_dub_refund", "Refund: Dub link job creation failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to start dub job.",
        });
      }
    }),
});
