/**
 * Video Router Ã¢â‚¬â€ file/link dubbing and translation with job system
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
import { promises as fs } from "fs";
import * as path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const videoRouter = t.router({
  dubFile: protectedProcedure
    .input(
      z.object({
        videoBase64: z.string(),
        filename: z.string(),
        voice: z.enum(["thiha", "nilar", "ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara"]),
        speed: z.number().optional().default(1.1),
        pitch: z.number().optional().default(0),
        srtEnabled: z.boolean().optional().default(true),
        srtFontSize: z.number().optional().default(24),
        srtColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#ffffff"),
        srtMarginV: z.number().optional().default(30),
        srtBlurBg: z.boolean().optional().default(true),
        srtBlurSize: z.number().optional().default(8),
        srtBlurOpacity: z.number().optional().default(80),
        srtBlurColor: z.enum(["black", "white", "transparent"]).optional().default("black"),
        srtBoxPadding: z.number().optional().default(4),
        srtFullWidth: z.boolean().optional().default(false),
        srtDropShadow: z.boolean().optional().default(true),
        srtBorderRadius: z.enum(["rounded", "square"]).optional().default("rounded"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 1: Security and Size check Ã¢â€â‚¬Ã¢â€â‚¬
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

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 2: Pre-flight environment check Ã¢â€â‚¬Ã¢â€â‚¬
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 3: Deduct credits BEFORE creating job Ã¢â€â‚¬Ã¢â€â‚¬
      const deducted = await deductCredits(userId, 10, "video_dub", `Video Dub: ${input.voice}`);
      if (!deducted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deduct credits. Please try again.",
        });
      }

      // Gate 4: Save base64 to temp file, store only path in job (prevents OOM)
      const tempDir = path.join(tmpdir(), `lumix_uploads`);
      await fs.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `dub_${userId}_${randomUUID()}.mp4`);
      try {
        const buffer = Buffer.from(input.videoBase64, "base64");
        await fs.writeFile(tempFilePath, buffer);
      } catch (writeErr: any) {
        await addCredits(userId, 10, "video_dub_refund", "Refund: Failed to save upload");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process upload. Please try again.",
        });
      }

      // Gate 5: Create job with temp file path only (no base64 in memory)
      try {
        const jobId = createJob("dub_file", {
          tempFilePath,
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
          srtBlurOpacity: input.srtBlurOpacity,
          srtBlurColor: input.srtBlurColor,
          srtBoxPadding: input.srtBoxPadding,
          srtFullWidth: input.srtFullWidth,
          srtDropShadow: input.srtDropShadow,
          srtBorderRadius: input.srtBorderRadius,
          userId,
        }, userId);

        return { jobId };
      } catch (error: any) {
        // Job creation failed — refund and clean up
        await addCredits(userId, 10, "video_dub_refund", `Refund: Video dub job creation failed`);
        await fs.unlink(tempFilePath).catch(() => {});
        console.error("[dubFile] Job creation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start dub job. Please try again.",
        });
      }
    }),

  dubLink: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        voice: z.enum(["thiha", "nilar", "ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara"]),
        speed: z.number().optional().default(1.1),
        pitch: z.number().optional().default(0),
        srtEnabled: z.boolean().optional().default(true),
        srtFontSize: z.number().optional().default(24),
        srtColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#ffffff"),
        srtMarginV: z.number().optional().default(30),
        srtBlurBg: z.boolean().optional().default(true),
        srtBlurSize: z.number().optional().default(8),
        srtBlurOpacity: z.number().optional().default(80),
        srtBlurColor: z.enum(["black", "white", "transparent"]).optional().default("black"),
        srtBoxPadding: z.number().optional().default(4),
        srtFullWidth: z.boolean().optional().default(false),
        srtDropShadow: z.boolean().optional().default(true),
        srtBorderRadius: z.enum(["rounded", "square"]).optional().default("rounded"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 1: URL validation Ã¢â€â‚¬Ã¢â€â‚¬
      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL. YouTube, TikTok, Facebook only.",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 2: Pre-flight environment check Ã¢â€â‚¬Ã¢â€â‚¬
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 3: Deduct credits BEFORE creating job Ã¢â€â‚¬Ã¢â€â‚¬
      // Duration pre-check (prevent credit deduction on too-long videos)
      try {
        const info = await downloaderService.getVideoInfo(input.url);
        if (info && info.duration > 150) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Video too long. Max 2 minutes 30 seconds.",
          });
        }
      } catch (err: any) {
        if (err.code === "BAD_REQUEST") throw err;
        console.warn("[video.router] Could not fetch video duration:", err.message);
      }

      const deducted = await deductCredits(userId, 10, "video_dub", `Video Dub Link: ${input.voice}`);
      if (!deducted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deduct credits. Please try again.",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 4: Create job Ã¢â€â‚¬Ã¢â€â‚¬
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
          srtBlurOpacity: input.srtBlurOpacity,
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
        console.error("[dubLink] Job creation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start dub job. Please try again.",
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
    .input(z.object({
      videoBase64: z.string(),
      filename: z.string(),
      userApiKey: z.string().regex(/^[A-Za-z0-9_\-]{20,100}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 1: Security and Size check Ã¢â€â‚¬Ã¢â€â‚¬
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

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 2: Pre-flight check Ã¢â€â‚¬Ã¢â€â‚¬
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 3: Deduct credits BEFORE creating job Ã¢â€â‚¬Ã¢â€â‚¬
      const deducted = await deductCredits(userId, 5, "video_translate", "Video Translate");
      if (!deducted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deduct credits. Please try again.",
        });
      }

      // Gate 4: Save base64 to temp file, store only path in job (prevents OOM)
      const transTempDir = path.join(tmpdir(), `lumix_uploads`);
      await fs.mkdir(transTempDir, { recursive: true });
      const transTempFilePath = path.join(transTempDir, `trans_${userId}_${randomUUID()}.mp4`);
      try {
        const transBuffer = Buffer.from(input.videoBase64, "base64");
        await fs.writeFile(transTempFilePath, transBuffer);
      } catch (writeErr: any) {
        await addCredits(userId, 5, "video_translate_refund", "Refund: Failed to save upload");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process upload. Please try again.",
        });
      }

      // Gate 5: Create job with temp file path only
      try {
        const jobId = createJob("translate_file", {
          tempFilePath: transTempFilePath,
          filename: input.filename,
          userId,
          userApiKey: input.userApiKey,
        }, userId);
        return { jobId };
      } catch (jobErr: any) {
        await addCredits(userId, 5, "video_translate_refund", "Refund: Translate file job creation failed");
        await fs.unlink(transTempFilePath).catch(() => {});
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start translation job. Please try again.",
        });
      }
    }),
  
  getTranslateJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) return { status: "failed" as const, error: "Job not found", progress: 0, message: "" };
      if (job.userId !== ctx.user!.userId && ctx.user!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),
  
  translateLink: protectedProcedure
    .input(z.object({
      url: z.string(),
      userApiKey: z.string().regex(/^[A-Za-z0-9_\-]{20,100}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user!.userId;

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 1: URL validation Ã¢â€â‚¬Ã¢â€â‚¬
      if (!isAllowedVideoUrl(input.url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or disallowed URL. YouTube, TikTok, Facebook only.",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 2: Pre-flight check Ã¢â€â‚¬Ã¢â€â‚¬
      try {
        await whisperService.checkEnvironment();
      } catch (envErr: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: envErr.message || "Server environment not ready",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 3: Deduct credits BEFORE creating job Ã¢â€â‚¬Ã¢â€â‚¬
      // Duration pre-check (prevent credit deduction on too-long videos)
      try {
        const info = await downloaderService.getVideoInfo(input.url);
        if (info && info.duration > 150) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Video too long. Max 2 minutes 30 seconds.",
          });
        }
      } catch (err: any) {
        if (err.code === "BAD_REQUEST") throw err;
        console.warn("[video.router] Could not fetch video duration:", err.message);
      }

      const deducted = await deductCredits(userId, 5, "video_translate", "Video Translate Link");
      if (!deducted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deduct credits. Please try again.",
        });
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Gate 4: Create job Ã¢â€â‚¬Ã¢â€â‚¬
      try {
        const jobId = createJob("translate_link", {
          url: input.url,
          userId,
          userApiKey: input.userApiKey,
        }, userId);
        return { jobId };
      } catch (jobErr: any) {
        await addCredits(userId, 5, "video_translate_refund", "Refund: Translate link job creation failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start translation job. Please try again.",
        });
      }
    }),
    
  getTranslateLinkJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await getJobAsync(input.jobId);
      if (!job) return { status: "failed" as const, error: "Job not found", progress: 0, message: "" };
      if (job.userId !== ctx.user!.userId && ctx.user!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return {
        status: job.status,
        progress: job.progress,
        message: job.message ?? "",
        error: job.error,
        result: job.status === "completed" ? job.result : undefined,
      };
    }),

  getLinkPreview: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .query(async ({ input }) => {
      const { fetchLinkPreview } = await import("../src/modules/media/services/linkPreview.service");
      return fetchLinkPreview(input.url);
    }),

  getVideoInfo: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .query(async ({ input }) => {
      const { getVideoInfo } = await import("../src/modules/media/services/downloader.service");
      const info = await getVideoInfo(input.url);
      return info ?? { duration: 0, filesize: 0, title: "", thumbnail: "" };
    }),
});
