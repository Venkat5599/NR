export type Bucket = { tokens: number; at: number };

export type RateLimiter = {
  /** Takes one token for [key]; false when the bucket is empty. */
  take(key: string): boolean;
};

const MAX_KEYS = 10_000;

/** An in-memory token bucket per key: [capacity] at once, refilled at one token per [refillMs]. */
export function createRateLimiter(capacity: number, refillMs: number, now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    take(key) {
      const t = now();
      const b = buckets.get(key) ?? { tokens: capacity, at: t };
      const tokens = Math.min(capacity, b.tokens + (t - b.at) / refillMs);
      if (buckets.size >= MAX_KEYS && !buckets.has(key)) buckets.clear();
      if (tokens < 1) {
        buckets.set(key, { tokens, at: t });
        return false;
      }
      buckets.set(key, { tokens: tokens - 1, at: t });
      return true;
    },
  };
}
