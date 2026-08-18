import "server-only";

const CHAT_RATE_LIMIT = 12;
const CHAT_RATE_WINDOW_MS = 5 * 60 * 1_000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const entries = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function checkChatRateLimit(
  userId: string,
  now = Date.now(),
): RateLimitResult {
  if (entries.size > 1_000) {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }

  const existing = entries.get(userId);

  if (!existing || existing.resetAt <= now) {
    entries.set(userId, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= CHAT_RATE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
