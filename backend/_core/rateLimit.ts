const attempts = new Map<string, { count: number; resetAt: number }>();

// 🔐 Login rate limit: 15-minute window (was 1 minute)
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
