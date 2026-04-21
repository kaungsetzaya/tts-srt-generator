/**
 * Settings Router — app settings management
 */
import { z } from "zod";
import { t, protectedProcedure, adminProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { settings } from "../../drizzle/schema";

// Allowed settings keys — prevents arbitrary key injection
const ALLOWED_SETTINGS_KEYS = [
  "trial_credits",
  "maintenance_mode",
  "max_video_size_mb",
  "max_video_duration_sec",
  "tts_api_url",
  "tts_audio_base_url",
  "tts_health_check_url",
  "auto_trial_enabled",
  "auto_trial_days",
  "trial_enabled",
  "trial_start_date",
  "trial_end_date",
] as const;

const allowedKeySchema = z.enum(ALLOWED_SETTINGS_KEYS);

export const settingsRouter = t.router({
  get: t.procedure.query(async () => {
    console.log("[DEBUG] Public settings.get called");
    const db = await getDb();
    if (!db) return {};
    try {
      const rows = await db.select().from(settings);
      const obj: Record<string, string> = {};
      const PUBLIC_KEYS = ["trial_credits", "maintenance_mode", "max_video_size_mb", "max_video_duration_sec", "auto_trial_enabled", "auto_trial_days", "trial_enabled", "trial_start_date", "trial_end_date"];
      for (const r of rows) {
        if (PUBLIC_KEYS.includes(r.keyName)) {
          obj[r.keyName] = r.value;
        }
      }
      return obj;
    } catch {
      return {};
    }
  }),

  getAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {};
    try {
      const rows = await db.select().from(settings);
      const obj: Record<string, string> = {};
      for (const r of rows) obj[r.keyName] = r.value;
      return obj;
    } catch {
      return {};
    }
  }),

  update: adminProcedure
    .input(z.object({
      key: allowedKeySchema,
      value: z.string().max(10000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .insert(settings)
        .values({ keyName: input.key, value: input.value })
        .onDuplicateKeyUpdate({ set: { value: input.value } });

      return { success: true };
    }),

  updateBulk: adminProcedure
    .input(z.object({
      trial_credits: z.string().max(10000).optional(),
      maintenance_mode: z.string().max(10000).optional(),
      max_video_size_mb: z.string().max(10000).optional(),
      max_video_duration_sec: z.string().max(10000).optional(),
      tts_api_url: z.string().max(10000).optional(),
      tts_audio_base_url: z.string().max(10000).optional(),
      tts_health_check_url: z.string().max(10000).optional(),
      auto_trial_enabled: z.string().max(10000).optional(),
      auto_trial_days: z.string().max(10000).optional(),
      trial_enabled: z.string().max(10000).optional(),
      trial_start_date: z.string().max(10000).optional(),
      trial_end_date: z.string().max(10000).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      for (const [key, val] of Object.entries(input)) {
        await db
          .insert(settings)
          .values({ keyName: key, value: val })
          .onDuplicateKeyUpdate({ set: { value: val } });
      }
      return { success: true };
    }),
});
