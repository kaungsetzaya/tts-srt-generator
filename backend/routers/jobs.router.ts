/**
 * Jobs Router — start dub jobs, check status
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { isAllowedVideoUrl } from "../_core/security";
import { createJob, getJobAsync } from "../jobs";
import { deductCredits, addCredits } from "./credits";
import { getVoiceCredits, type VoiceId } from "../src/modules/tts";

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

export const jobsRouter = t.router({
  startDub: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        voice: z.enum(ALL_VOICE_IDS),
        srtEnabled: z.boolean().optional().default(true),
        srtFontSize: z.number().optional().default(24),
        srtColor: z.string().optional().default("#ffffff"),
        srtMarginV: z.number().optional().default(30),
        srtBlurBg: z.boolean().optional().default(true),
        srtBlurSize: z.number().optional().default(8),
        srtBlurColor: z.enum(["black", "white"]).optional().default("black"),
        srtBoxPadding: z.number().optional().default(4),
        srtFullWidth: z.boolean().optional().default(false),
        srtDropShadow: z.boolean().optional().default(true),
        srtBorderRadius: z.enum(["rounded", "square"]).optional().default("rounded"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL",
        });
      }

      const creditsNeeded = getVoiceCredits(input.voice as VoiceId);

      await deductCredits(
        userId,
        creditsNeeded,
        "video_dub",
        `Video Dub: ${input.voice}`
      );

      try {
        const jobId = createJob("dub_link", {
          url: input.url,
          voice: input.voice,
          speed: 1.6,
          pitch: 0,
          srtEnabled: input.srtEnabled,
          srtFontSize: input.srtFontSize,
          srtColor: input.srtColor,
          srtMarginV: input.srtMarginV,
          srtBlurBg: input.srtBlurBg,
          srtBlurSize: input.srtBlurSize,
          srtBlurColor: input.srtBlurColor,
          srtBoxPadding: input.srtBoxPadding,
          srtFullWidth: input.srtFullWidth,
          srtDropShadow: input.srtDropShadow,
          srtBorderRadius: input.srtBorderRadius,
          userId,
        }, userId);

        return { jobId };
      } catch (error: any) {
        await addCredits(userId, creditsNeeded, "video_dub_refund", "Refund: Dub link job creation failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to start dub job.",
        });
      }
    }),

  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) {
        return { status: "not_found" as const, progress: 0, message: "" };
      }
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
});
