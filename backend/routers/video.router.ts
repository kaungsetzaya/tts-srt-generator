/**
 * Video Router — file/link dubbing and translation with job system
 * 
 * CRITICAL: Credits are deducted BEFORE job creation to prevent the race
 * condition where a job auto-dispatches before credits are checked.
 */
import { z } from "zod";
import { t, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { isAllowedVideoUrl, validateBase64VideoPrefix } from "../_core/security";
import { createJob, getJobAsync, updateJob } from "../jobs";
import { deductCredits, addCredits } from "./credits";
import { whisperService } from "../src/modules/translation/services/whisper.service";
import { downloaderService } from "../src/modules/media/services/downloader.service";

export const videoRouter = t.router({
  dubFile: protectedProcedure
    .input(
      z.object({
        videoBase64: z.string(),
        filename: z.string(),
        voice: z.enum(["thiha", "nilar", "ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara"]),
        speed: z.number().optional().default(1.6),
        pitch: z.number().optional().default(0),
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

      // ── Gate 1: Security and Size check ──
      if (!validateBase64VideoPrefix(input.videoBase64)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid video file format.",
        });
      }
      const videoSize = input.videoBase64.length * 0.75;
      if (videoSize > 25 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File too large. Max 25MB.",
        });
      }

      // ── Gate 2: Pre-flight environment check ──
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // ── Gate 3: Deduct credits BEFORE creating job ──
      await deductCredits(userId, 10, "video_dub", `Video Dub: ${input.voice}`);

      // ── Gate 4: Create job (auto-dispatches to processor) ──
      try {
        const jobId = createJob("dub_file", {
          videoBase64: input.videoBase64,
          filename: input.filename,
          voice: input.voice,
          speed: input.speed,
          pitch: input.pitch,
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
        // Job creation failed — refund immediately
        await addCredits(userId, 10, "video_dub_refund", `Refund: Video dub job creation failed`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to start dub job.",
        });
      }
    }),

  dubLink: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar", "ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara"]),
        speed: z.number().optional().default(1.6),
        pitch: z.number().optional().default(0),
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

      // ── Gate 1: URL validation ──
      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL. YouTube, TikTok, Facebook only.",
        });
      }

      // ── Gate 2: Pre-flight environment check ──
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // ── Gate 3: Deduct credits BEFORE creating job ──
      await deductCredits(userId, 10, "video_dub", `Video Dub Link: ${input.voice}`);

      // ── Gate 4: Create job ──
      try {
        const jobId = createJob("dub_link", {
          url: input.url,
          voice: input.voice,
          speed: input.speed,
          pitch: input.pitch,
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
        await addCredits(userId, 10, "video_dub_refund", "Refund: Dub link job creation failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to start dub job.",
        });
      }
    }),

  previewLink: t.procedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const info = await downloaderService.getVideoInfo(input.url);
        if (!info) {
          return { title: "Video", duration: 0, thumbnail: "" };
        }
        const parsed = new URL(input.url);
        let title = "Video";
        let thumbnail = "";
        if (parsed.hostname?.includes("youtube.com") || parsed.hostname?.includes("youtu.be")) {
          const videoIdMatch = input.url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          }
        }
        return { title, duration: info.duration, thumbnail };
      } catch {
        return { title: "Video", duration: 0, thumbnail: "" };
      }
    }),

  translate: protectedProcedure
    .input(z.object({ videoBase64: z.string(), filename: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // ── Gate 1: Security and Size check ──
      if (!validateBase64VideoPrefix(input.videoBase64)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid video file format.",
        });
      }
      const videoSize = input.videoBase64.length * 0.75;
      if (videoSize > 25 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File too large. Max 25MB.",
        });
      }

      // ── Gate 2: Pre-flight check ──
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // ── Gate 3: Deduct credits BEFORE creating job ──
      await deductCredits(userId, 5, "video_translate", "Video Translate");
      
      // ── Gate 4: Create job ──
      const jobId = createJob("translate_file", { 
        videoBase64: input.videoBase64, 
        filename: input.filename,
        userId 
      }, userId);
      
      return { jobId };
    }),
  
  getTranslateJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) return { status: "failed" as const, error: "Job not found", progress: 0, message: "" };
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
  
  translateLink: protectedProcedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // ── Gate 1: URL validation ──
      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL. YouTube, TikTok, Facebook only.",
        });
      }

      // ── Gate 2: Pre-flight check ──
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // ── Gate 3: Deduct credits BEFORE creating job ──
      await deductCredits(userId, 5, "video_translate", "Video Translate Link");
      
      // ── Gate 4: Create job ──
      const jobId = createJob("translate_link", { 
        url: input.url,
        userId 
      }, userId);
      
      return { jobId };
    }),
    
  getTranslateLinkJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) return { status: "failed" as const, error: "Job not found", progress: 0, message: "" };
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
});
