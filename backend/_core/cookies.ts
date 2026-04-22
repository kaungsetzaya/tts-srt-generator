import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

// Check if request is coming through a known proxy (Vercel, Cloudflare, nginx)
function isProxiedRequest(req: Request): boolean {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  return !!(forwardedFor || forwardedProto || forwardedHost);
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);
  // When proxied (Vercel/nginx), use "none" to allow cross-site cookies
  // Direct access uses "strict" for HTTPS, "lax" for HTTP
  const sameSite = isProxiedRequest(req) ? "none" : (secure ? "strict" : "lax");
  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
  };
}
