import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: { userId: string; telegramId: string; name: string; role: string } | null;
};

// 🔐 JWT Secret
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("[SECURITY] FATAL: JWT_SECRET is not set!");
  process.exit(1);
}
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-only-secret-do-not-use-in-production"
);

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: TrpcContext["user"] = null;
  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const token = cookies[COOKIE_NAME];
      if (token) {
        const { payload } = await jwtVerify(token, JWT_SECRET, {
          algorithms: ["HS256"],
        });

        // 🔐 One-Device Session Check
        // JWT ထဲက sid နှင့် DB ထဲက session_token ကို ယှဉ်စစ်သည်
        // မတူရင် — နောက်တစ်ခြား device ကနေ login ဝင်သွားပြီ ⟹ ဒီ session ပယ်ဖျက်
        const sid = payload.sid as string | undefined;
        if (sid) {
          const db = await getDb();
          if (db) {
            const row = await db.select({ sessionToken: users.sessionToken, bannedAt: users.bannedAt })
              .from(users).where(eq(users.id, payload.userId as string)).limit(1);
            if (row.length > 0) {
              // Session token မတူ → invalidate
              if (row[0].sessionToken && row[0].sessionToken !== sid) {
                return { req: opts.req, res: opts.res, user: null };
              }
              // Banned check
              if (row[0].bannedAt) {
                return { req: opts.req, res: opts.res, user: null };
              }
            }
          }
        }

        user = {
          userId: payload.userId as string,
          telegramId: payload.telegramId as string,
          name: payload.name as string,
          role: (payload.role as string) ?? "user",
        };
      }
    }
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
