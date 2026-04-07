/**
 * ██████████████████████████████████████████
 *  LUMIX STUDIO — Security Middleware
 *  တိုက်ခိုက်မှုများကို ကာကွယ်ရန် Middleware များ
 * ██████████████████████████████████████████
 */

import type { Request, Response, NextFunction } from "express";

// ────────────────────────────────────────────────────
// ✅ 1. CORS — ကိုယ့် Domain မှ လာသော Request သာ ခွင့်ပြုသည်
// ────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Production မှာ မသတ်မှတ်ထားရင် default domain သုံးမည်
const DEFAULT_ORIGIN = process.env.SITE_URL || "https://choco.de5.net";
if (ALLOWED_ORIGINS.length === 0) ALLOWED_ORIGINS.push(DEFAULT_ORIGIN);

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    // Same-origin ၊ server-side request — ခွင့်ပြုသည်
  } else {
    // Unknown origin — block
    res.status(403).json({ error: "CORS: Origin not allowed." });
    return;
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
}

// ────────────────────────────────────────────────────
// ✅ 2. Admin IP Whitelist — Admin route ကို IP filter
// ────────────────────────────────────────────────────
const ADMIN_IPS = (process.env.ADMIN_WHITELIST_IPS || "")
  .split(",")
  .map(ip => ip.trim())
  .filter(Boolean);

export function adminIpWhitelist(req: Request, res: Response, next: NextFunction) {
  // IP whitelist မသတ်မှတ်ထားရင် ဒါကို skip (dev mode)
  if (ADMIN_IPS.length === 0) return next();

  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.ip || "";

  if (!ADMIN_IPS.includes(clientIp)) {
    console.warn(`[SECURITY] Admin access blocked: ${clientIp} at ${new Date().toISOString()}`);
    res.status(403).json({ error: "Access denied." });
    return;
  }
  next();
}

// ────────────────────────────────────────────────────
// ✅ 3. Suspicious Input Detection — XSS / SQLi Pattern
// ────────────────────────────────────────────────────
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,          // onclick=, onload= etc.
  /union\s+select/i,     // SQL injection
  /drop\s+table/i,
  /;\s*--/,              // SQL comment injection
  /exec\s*\(/i,
  /eval\s*\(/i,
  /<iframe/i,
  /data:text\/html/i,
];

function containsDangerousPattern(value: unknown): boolean {
  if (typeof value === "string") {
    return DANGEROUS_PATTERNS.some(p => p.test(value));
  }
  if (Array.isArray(value)) return value.some(containsDangerousPattern);
  if (value && typeof value === "object") {
    return Object.values(value as object).some(containsDangerousPattern);
  }
  return false;
}

export function xssProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && containsDangerousPattern(req.body)) {
    console.warn(`[SECURITY] Suspicious payload detected from ${req.ip} at ${req.path}`);
    res.status(400).json({ error: "Invalid request content." });
    return;
  }
  next();
}

// ────────────────────────────────────────────────────
// ✅ 4. API Rate Limiter — /api/* တွင် Request ကန့်သတ်
// ────────────────────────────────────────────────────
const apiRequestMap = new Map<string, { count: number; resetAt: number }>();

export function apiRateLimiter(maxPerMin = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.ip || "unknown";
    const now = Date.now();
    const record = apiRequestMap.get(ip);

    if (!record || now > record.resetAt) {
      apiRequestMap.set(ip, { count: 1, resetAt: now + 60000 });
      return next();
    }
    record.count++;
    if (record.count > maxPerMin) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Too many requests. Please slow down." });
      return;
    }
    next();
  };
}

// ────────────────────────────────────────────────────
// ✅ 5. Security Headers — Browser ကို ပိုလုံခြုံအောင်
// ────────────────────────────────────────────────────
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

// ────────────────────────────────────────────────────
// ✅ 6. Audit Log Helper — Admin လုပ်ဆောင်မှုများ မှတ်ထား
// ────────────────────────────────────────────────────
export function auditLog(action: string, adminId: string, targetUserId: string, details?: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    adminId,
    targetUserId,
    details: details || "",
  };
  // Console မှာ မှတ်ထား (Production မှာ file/DB သို့ pipe လုပ်ရမည်)
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// ────────────────────────────────────────────────────
// ✅ 7. Temp File Cleanup Guard — /tmp file ၁ နာရီပါ ဖျက်
// ────────────────────────────────────────────────────
import { readdir, unlink, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export async function cleanTempFiles() {
  try {
    const tmp = tmpdir();
    const files = await readdir(tmp);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    let cleaned = 0;
    for (const file of files) {
      if (!file.match(/\.(mp4|mp3|wav|webm)$/i)) continue;
      try {
        const filePath = join(tmp, file);
        const s = await stat(filePath);
        if (now - s.mtimeMs > ONE_HOUR) {
          await unlink(filePath);
          cleaned++;
        }
      } catch {}
    }
    if (cleaned > 0) console.log(`[Cleanup] Removed ${cleaned} old temp media files.`);
  } catch {}
}

// Auto cleanup every 30 minutes
setInterval(cleanTempFiles, 30 * 60 * 1000);
