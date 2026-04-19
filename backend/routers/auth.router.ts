import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../../db";
import { checkRateLimit, clearRateLimit } from "../../_core/rateLimit";
import { users, subscriptions, creditTransactions } from "../../../drizzle/schema";
import { eq, count, sql, gt, and } from "drizzle-orm";
import { SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import superjson from "superjson";
import type { TrpcContext } from "../../_core/context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user)
    throw new TRPCError({ code: "UNAUTHORIZED", error: "Login required" });
  return next({ ctx: { ...ctx, user: ctx.user } } as any);
});

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

  verify: protectedProcedure
    .input(z.object({ code: z.string().min(6).max(6).regex(/^\d+$/, "Code must be 6 digits") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // ... verify logic
      return { user: ctx.user, token: "jwt_token" };
    }),
});

export default authRouter;
export type AuthRouter = typeof authRouter;