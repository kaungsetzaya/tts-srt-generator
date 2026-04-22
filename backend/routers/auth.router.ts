/**
 * Auth Router Ã¢â‚¬â€ login/logout/verify procedures
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { t } from "./trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { checkRateLimit, clearRateLimit } from "../_core/rateLimit";
import { users, creditTransactions, settings } from "../../shared/drizzle/schema";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "@shared/const";

export const authRouter = t.router({
  me: t.procedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return ctx.user;
  }),

  logout: t.procedure.mutation(async ({ ctx }) => {
    ctx.res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure`
    );
    return { success: true };
  }),

  verify: t.procedure
    .input(z.object({ code: z.string().min(6).max(6).regex(/^\d+$/, "Code must be 6 digits") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });

      // Rate limiting check
      const forwardedFor = ctx.req?.headers?.["x-forwarded-for"];
      const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() 
        || (ctx.req?.headers?.["x-real-ip"] as string)?.trim()
        || "unknown";
      
      const rateLimitKey = `verify_${clientIp}`;
      if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again in 15 minutes.",
        });
      }

      const code = input.code.replace(/[^\d]/g, "").slice(0, 6);
      
      // Admin bypass
      const ADMIN_BYPASS_CODE = process.env.ADMIN_BYPASS_CODE;
      const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
      if (!ADMIN_TELEGRAM_ID) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Server configuration error",
        });
      }
      if (ADMIN_BYPASS_CODE && code === ADMIN_BYPASS_CODE) {
        const adminUser = await db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.telegramId, ADMIN_TELEGRAM_ID),
        });
        if (adminUser) {
          const sessionToken = randomUUID();
          await db.update(users).set({ sessionToken, lastLoginAt: new Date() }).where(eq(users.id, adminUser.id));
        if (!process.env.JWT_SECRET) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Server configuration error",
          });
        }
          const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
          const token = await new SignJWT({
            userId: adminUser.id,
            telegramId: adminUser.telegramId || "",
            name: adminUser.telegramFirstName || adminUser.name || "Admin",
            role: "admin",
            sid: sessionToken,
          }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(JWT_SECRET);
          ctx.res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7*24*60*60}; SameSite=None; Secure`);
          return { success: true, userId: adminUser.id, role: "admin" };
        }
      }

      const user = await db.query.users.findFirst({
        where: (u: any, { eq }: any) => eq(u.telegramCode, code),
      });

      if (
        !user ||
        !user.telegramCodeExpiresAt ||
        new Date(user.telegramCodeExpiresAt) < new Date()
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired code",
        });
      }

      clearRateLimit(rateLimitKey);

      const sessionToken = randomUUID();
      if (!process.env.JWT_SECRET) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Server configuration error",
        });
      }
      const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

      await db
        .update(users)
        .set({
          telegramCode: null,
          sessionToken,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Grant trial credits on first login
      try {
        const existingTx = await db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, user.id))
          .limit(1);
        if (existingTx.length === 0) {
          const [settRow] = await db.select().from(settings).where(eq(settings.keyName, "trial_credits")).limit(1);
          const trialCredits = parseInt((settRow?.value as string) ?? "15");
          await db.update(users).set({ credits: (user.credits ?? 0) + trialCredits }).where(eq(users.id, user.id));
          await db.insert(creditTransactions).values({
            id: randomUUID(),
            userId: user.id,
            amount: trialCredits,
            type: "trial",
            description: `Trial credits on first login (+${trialCredits} credits)`,
          });
          console.log(`[Credits] Granted ${trialCredits} trial credits to new user ${user.id}`);
        }
      } catch (trialErr) {
        console.error("[Credits] Trial grant failed:", trialErr);
      }

      const token = await new SignJWT({
        userId: user.id,
        telegramId: user.telegramId || "",
        name: user.telegramFirstName || user.name || "User",
        role: user.role || "user",
        sid: sessionToken,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(JWT_SECRET);

      ctx.res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=None; Secure`
      );

      return { success: true, userId: user.id, role: user.role || "user" };
    }),
});
