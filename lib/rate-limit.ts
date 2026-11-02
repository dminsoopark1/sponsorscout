type Bucket = number[];

const buckets = new Map<string, Bucket>();

export const ANALYSIS_LIMITS = {
  anonymous: { limit: 8, windowMs: 10 * 60 * 1000 },
  authenticated: { limit: 30, windowMs: 10 * 60 * 1000 },
  anonymousGlobal: { limit: 60, windowMs: 60 * 1000 },
} as const;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  prune(now);
  const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > now - windowMs);
  if (recent.length >= limit) {
    const retryAt = recent[0] + windowMs;
    buckets.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)) };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true, remaining: limit - recent.length };
}

function prune(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, hits] of buckets) {
    if (hits.every((timestamp) => timestamp <= now - ANALYSIS_LIMITS.anonymous.windowMs)) buckets.delete(key);
  }
}

export function resetRateLimits() {
  buckets.clear();
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim() ?? '';
    if (first && first.length <= 64 && !/\s/.test(first)) return first;
  }
  const real = headers.get('x-real-ip')?.trim() ?? '';
  if (real && real.length <= 64 && !/\s/.test(real)) return real;
  return 'unknown';
}

export function takeAnalysisToken(input: { userId: string | null; ip: string }, now = Date.now()): RateLimitResult {
  if (input.userId) {
    return rateLimit(
      `analysis:user:${input.userId}`,
      ANALYSIS_LIMITS.authenticated.limit,
      ANALYSIS_LIMITS.authenticated.windowMs,
      now,
    );
  }
  const personal = rateLimit(
    `analysis:ip:${input.ip || 'unknown'}`,
    ANALYSIS_LIMITS.anonymous.limit,
    ANALYSIS_LIMITS.anonymous.windowMs,
    now,
  );
  if (!personal.ok) return personal;
  const globalLimit = rateLimit(
    'analysis:anon-global',
    ANALYSIS_LIMITS.anonymousGlobal.limit,
    ANALYSIS_LIMITS.anonymousGlobal.windowMs,
    now,
  );
  if (!globalLimit.ok) return globalLimit;
  return personal;
}
