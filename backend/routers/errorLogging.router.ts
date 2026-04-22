/**
 * Browser Error Logging Ã¢â‚¬â€ catches frontend crashes
 * Called by frontend/src/main.tsx via window.onerror and unhandledrejection
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { errorLogs } from "../../shared/drizzle/schema";

// Simple in-memory rate limiter for public error logging (prevent log flooding)
const errorLogLimits = new Map<string, { count: number; resetAt: number }>();
const ERROR_LOG_MAX_PER_MIN = 10;

function checkErrorLogRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = errorLogLimits.get(ip);
  if (!record || now > record.resetAt) {
    errorLogLimits.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  record.count++;
  return record.count <= ERROR_LOG_MAX_PER_MIN;
}

export const errorLoggingRouter = t.procedure
  .input(
    z.object({
      errorMessage: z.string().max(2000),
      source: z.enum(["window.onerror", "unhandledrejection", "react_error_boundary"]),
      stackTrace: z.string().max(5000).optional(),
      url: z.string().max(500).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const ip = (ctx.req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || (ctx.req?.headers?.["x-real-ip"] as string)
      || ctx.req?.ip || "unknown";

    if (!checkErrorLogRateLimit(ip)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many error logs. Please try again later.",
      });
    }

    const db = await getDb();
    if (!db) return { success: false };
    try {
      await db.insert(errorLogs).values({
        id: randomUUID(),
        userId: ctx.user?.userId ?? null,
        feature: "browser",
        errorCode: input.source,
        errorMessage: input.errorMessage,
        stackTrace: input.stackTrace ?? null,
        severity: "error",
        resolved: false,
      });
      return { success: true };
    } catch (e) {
      console.error("[logBrowserError]", e);
      return { success: false };
    }
  });
