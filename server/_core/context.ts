import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: { userId: string; telegramId: string; name: string } | null;
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "secret"
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
        user = {
          userId: payload.userId as string,
          telegramId: payload.telegramId as string,
          name: payload.name as string,
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
