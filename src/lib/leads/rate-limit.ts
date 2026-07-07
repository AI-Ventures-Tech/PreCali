// PreCali — In-memory LRU rate limiter by IP (decision Q2 = in-memory LRU).
// Sufficient for a single-server Vercel Node function; not shared across instances.
// Cap = MAX_ENTRIES evicts oldest insertion to avoid unbounded memory growth.

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_ENTRIES = 10_000;

const buckets = new Map<string, Bucket>();

function now(): number {
  return Date.now();
}

function touch(ip: string, bucket: Bucket): void {
  // Re-insert so the key moves to the end of the Map's insertion order → LRU recency.
  buckets.delete(ip);
  buckets.set(ip, bucket);
}

function evictIfTooBig(): void {
  while (buckets.size > MAX_ENTRIES) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/**
 * Records a request from `ip` and reports whether it exceeds the limit.
 * Returns `true` if the caller MUST reject (429); `false` if it may proceed.
 */
export function isRateLimited(ip: string): boolean {
  const t = now();
  const existing = buckets.get(ip);
  if (existing && existing.resetAt > t) {
    existing.count += 1;
    touch(ip, existing);
    return existing.count > MAX_REQUESTS;
  }
  const fresh: Bucket = { count: 1, resetAt: t + WINDOW_MS };
  buckets.set(ip, fresh);
  evictIfTooBig();
  return false;
}

/** Test/maintenance helper: clears all buckets. */
export function resetRateLimiter(): void {
  buckets.clear();
}

/** Test/maintenance helper: read-only view of the current bucket for an IP. */
export function getBucket(ip: string): Bucket | undefined {
  const b = buckets.get(ip);
  return b ? { count: b.count, resetAt: b.resetAt } : undefined;
}
