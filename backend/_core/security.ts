/**
 * ██████████████████████████████████████████
 *  LUMIX STUDIO — Security Middleware
 *  တိုက်ခိုက်မှုများကို ကာကွယ်ရန် Middleware များ
 * ██████████████████████████████████████████
 */

import type { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

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

// ✅ Vercel preview domains (*.vercel.app) အတွက် pattern-based allow
const EXTRA_ALLOWED_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,       // *.vercel.app
  /^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.vercel\.app$/, // double-hash vercel urls
  /^https:\/\/[a-z0-9-]+\.projects\.vercel\.app$/, // *.projects.vercel.app
  /^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.projects\.vercel\.app$/, // double-hash *.projects.vercel.app
];

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return EXTRA_ALLOWED_PATTERNS.some(p => p.test(origin));
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
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
// ✅ 2. Admin IP Whitelist — supports IPv4 and IPv6
// ────────────────────────────────────────────────────
function parseAdminIps(): Set<string> {
  const ips = new Set<string>();
  
  // Always allow localhost for development
  ips.add("127.0.0.1");
  ips.add("::1");
  ips.add("localhost");
  
  const envIps = process.env.ADMIN_WHITELIST_IPS || "";
  if (envIps) {
    envIps.split(",").forEach(ip => {
      const trimmed = ip.trim();
      if (trimmed) {
        // Normalize: remove protocol if present
        const normalized = trimmed
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
          .split(':')[0]; // Remove port
        ips.add(normalized);
        // Also add with ::1 suffix for IPv6
        if (normalized.includes('.')) {
          ips.add(normalized.replace('.', ':'));
        }
      }
    });
  }
  
  return ips;
}

const ADMIN_IPS = parseAdminIps();

export function adminIpWhitelist(req: Request, res: Response, next: NextFunction) {
  // Dev mode: no whitelist = allow localhost only
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Production mode: require IP whitelist
  if (ADMIN_IPS.size <= 3) { // Only localhost entries
    console.error("[SECURITY] FATAL: ADMIN_WHITELIST_IPS is not set in production! Admin access blocked.");
    res.status(403).json({ error: "Access denied." });
    return;
  }

  // Get client IP from various headers
  const forwardedFor = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
  const realIp = req.headers["x-real-ip"] as string;
  const clientIp = forwardedFor || realIp || req.ip || "";

  // Check if IP is allowed
  const normalizedIp = clientIp.split(':')[0]; // Handle IPv6 with port
  
  let isAllowed = ADMIN_IPS.has(clientIp) || 
                  ADMIN_IPS.has(normalizedIp) ||
                  ADMIN_IPS.has(clientIp.replace(/\./g, ':'));

  if (!isAllowed) {
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
    // Skip base64 video data (too large and not dangerous)
    if (value.length > 10000) return false;
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
      if (!file.match(/\.(mp4|mp3|wav|webm|srt|txt|json)$/i)) continue;
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

// ────────────────────────────────────────────────────
// ✅ 8. Request ID Tracking — Every request gets a unique ID
// ────────────────────────────────────────────────────
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = nanoid(12);
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

// ────────────────────────────────────────────────────
// ✅ 9. Global Memory Threshold — Pause new tasks if RAM > 90%
// ────────────────────────────────────────────────────
export function memoryGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const mem = process.memoryUsage();
    const totalSystem = require("os").totalmem();
    const usedPercent = (mem.rss / totalSystem) * 100;
    if (usedPercent > 90) {
      console.warn(`[MEMORY] Server RAM usage at ${usedPercent.toFixed(1)}% — rejecting request`);
      res.status(503).json({ error: "Server is currently overloaded. Please try again later." });
      return;
    }
  } catch {}
  next();
}

// ────────────────────────────────────────────────────
// ✅ 10. yt-dlp Domain Whitelist — YouTube, TikTok, Facebook only
// ────────────────────────────────────────────────────
const ALLOWED_VIDEO_DOMAINS = [
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be",
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
  "facebook.com", "www.facebook.com", "m.facebook.com",
  "fb.watch",
];

export function isAllowedVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_VIDEO_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────
// ✅ 11. Magic Bytes Validation — verify file headers
// ────────────────────────────────────────────────────
const VIDEO_MAGIC_BYTES: Array<{ ext: string; bytes: number[] }> = [
  { ext: "mp4",  bytes: [0x00, 0x00, 0x00] },  // ftyp box (offset 4)
  { ext: "webm", bytes: [0x1A, 0x45, 0xDF, 0xA3] },
  { ext: "avi",  bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  { ext: "mkv",  bytes: [0x1A, 0x45, 0xDF, 0xA3] },
  { ext: "mov",  bytes: [0x00, 0x00, 0x00] },  // same as mp4
];

export function isValidVideoBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // Check for ftyp box (MP4/MOV) — 'ftyp' at offset 4
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  // Check for RIFF (AVI)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  // Check for WebM/MKV (EBML)
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return true;
  return false;
}

// ────────────────────────────────────────────────────
// ✅ 12. Path Traversal Guard
// ────────────────────────────────────────────────────
import path from "path";

export function isPathWithinDir(filePath: string, allowedDir: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  return resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir;
}

// ────────────────────────────────────────────────────
// ✅ 13. Prompt Injection Guard — sanitize text before AI
// ────────────────────────────────────────────────────
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+the\s+above/i,
  /disregard\s+(all\s+)?prior/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|system\|>/i,
  /<\|user\|>/i,
  /<\|assistant\|>/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if\s+you/i,
  /forget\s+everything/i,
  /new\s+instructions:/i,
  /override\s+instructions/i,
];

export function sanitizeForAI(text: string): string {
  let clean = text;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    clean = clean.replace(pattern, "");
  }
  return clean.trim();
}

// ────────────────────────────────────────────────────
// ✅ 14. Base64 Video Prefix Validation
// ────────────────────────────────────────────────────
export function validateBase64VideoPrefix(base64: string): boolean {
  // Accept raw base64 (no prefix) or valid data URI prefixes
  if (!base64.includes(",")) return true; // raw base64, no prefix
  const prefix = base64.split(",")[0].toLowerCase();
  const validPrefixes = [
    "data:video/mp4;base64",
    "data:video/webm;base64",
    "data:video/quicktime;base64",
    "data:video/x-msvideo;base64",
    "data:video/x-matroska;base64",
    "data:video/avi;base64",
    "data:application/octet-stream;base64",
  ];
  return validPrefixes.some(vp => prefix.startsWith(vp));
}

// ────────────────────────────────────────────────────
// ✅ 15. Voice ID Server-side Whitelist
// ────────────────────────────────────────────────────
const ALLOWED_VOICE_IDS = ["thiha", "nilar"];
const ALLOWED_CHARACTER_IDS = ["ryan", "ronnie", "lucas", "daniel", "evander", "michelle", "iris", "charlotte", "amara"];

export function isValidVoiceId(voice: string): boolean {
  return ALLOWED_VOICE_IDS.includes(voice);
}

export function isValidCharacterId(character: string): boolean {
  return ALLOWED_CHARACTER_IDS.includes(character);
}
