const attempts = new Map<string, { count: number; resetAt: number }>();
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts.entries()) {
    if (now > record.resetAt) {
      attempts.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

// Login rate limit: 5 attempts per 15 minutes
export function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) return false;

  record.count++;
  return true;
}

export function clearRateLimit(ip: string) {
  attempts.delete(ip);
}