/**
 * Settings Router — app settings management
 */
import { z } from "zod";
import { t, adminProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { settings } from "../../drizzle/schema";

export const settingsRouter = t.router({
  get: protectedProcedure.query(async () => {
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
    .input(z.union([
      z.object({ key: z.string(), value: z.string() }),
      z.object({}).passthrough(),
    ]))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if ('key' in input && 'value' in input) {
        await db
          .insert(settings)
          .values({ keyName: input.key, value: input.value })
          .onDuplicateKeyUpdate({ set: { value: input.value } });
      } else {
        for (const [key, val] of Object.entries(input)) {
          await db
            .insert(settings)
            .values({ keyName: key, value: String(val) })
            .onDuplicateKeyUpdate({ set: { value: String(val) } });
        }
      }
      return { success: true };
    }),
});
