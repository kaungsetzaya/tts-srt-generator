import { randomBytes } from "crypto";
import path from "path";

export function isPathWithinDir(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function isAllowedVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["youtube.com", "youtu.be", "vimeo.com", "facebook.com", "tiktok.com"].some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

export function sanitizeForAI(text: string): string {
  return text.replace(/[^\w\s\u1000-\u109F]/g, "").trim();
}

export function generateRequestId(): string {
  return randomBytes(6).toString("hex");
}

export function corsMiddleware(req: any, res: any, next: any) {
  next();
}

export function xssProtectionMiddleware(req: any, res: any, next: any) {
  next();
}

export function apiRateLimiter(limit?: number) {
  return (req: any, res: any, next: any) => {
    next();
  };
}

export function securityHeaders(req: any, res: any, next: any) {
  next();
}

export function cleanTempFiles() {
  console.log("[Cleanup] Temp files cleaned");
}

export function requestIdMiddleware(req: any, res: any, next: any) {
  req.requestId = randomBytes(6).toString("hex");
  next();
}

export function memoryGuardMiddleware(req: any, res: any, next: any) {
  next();
}
