/**
 * API Rate Limiting for video processing endpoints
 * Prevents abuse and resource exhaustion attacks
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstAttempt: number;
}

// Per-user rate limits for heavy operations
const videoProcessingLimits = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// Limits per user per hour
const LIMITS = {
  dubLink: 20,        // AI dub from link
  dubFile: 20,        // AI dub from file
  translateLink: 30,  // Video translate from link
  translateFile: 30,   // Video translate from file
  tts: 100,          // TTS requests
};

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, entry] of videoProcessingLimits.entries()) {
    if (now > entry.resetAt) {
      videoProcessingLimits.delete(key);
    }
  }
}

// Start cleanup interval
setInterval(cleanupOldEntries, CLEANUP_INTERVAL);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds until reset
}

export function checkVideoApiRateLimit(userId: string, action: keyof typeof LIMITS): RateLimitResult {
  const key = `${userId}:${action}`;
  const limit = LIMITS[action];
  const now = Date.now();

  let entry = videoProcessingLimits.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    entry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
      firstAttempt: now
    };
    videoProcessingLimits.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetIn: Math.ceil(RATE_LIMIT_WINDOW / 1000) };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetAt - now) / 1000)
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000)
  };
}

// Global IP-based rate limit for unauthenticated requests
const ipRateLimits = new Map<string, RateLimitEntry>();

const IP_LIMITS = {
  default: 100,    // 100 requests per hour per IP
  auth: 10,        // 10 login attempts per 15 min
};

export function checkIpRateLimit(ip: string, type: keyof typeof IP_LIMITS = 'default'): RateLimitResult {
  const key = `${ip}:${type}`;
  const limit = IP_LIMITS[type];
  const windowMs = type === 'auth' ? 15 * 60 * 1000 : RATE_LIMIT_WINDOW;
  const now = Date.now();

  let entry = ipRateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs, firstAttempt: now };
    ipRateLimits.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetIn: Math.ceil(windowMs / 1000) };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetIn: Math.ceil((entry.resetAt - now) / 1000) };
}
