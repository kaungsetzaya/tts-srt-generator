/**
 * Shared tRPC initialization — imported by all router files.
 * Keeps procedure definitions (protectedProcedure, adminProcedure) in one place.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "../_core/context";

export const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

// ─── Typed context helpers ────────────────────
type AuthenticatedContext = TrpcContext & {
  user: NonNullable<TrpcContext["user"]>;
};

// Protected procedure (requires auth)
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required" });
  return next({ ctx: { ...ctx, user: ctx.user } as AuthenticatedContext });
});

// Admin procedure (requires auth + admin role)
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  return next({ ctx: { ...ctx, user: ctx.user } as AuthenticatedContext });
});
