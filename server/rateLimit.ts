// A simple per-IP rate limiter (DESIGN.md §7): a fixed one-minute window
// counted in memory. Each Cloudflare location (and each copy of the
// function) keeps its own count, so this stops runaway use rather than
// being exact. A Cloudflare rate-limiting rule can be added on top in the
// dashboard (see README).

export class RateLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one request; returns 0 when allowed, else the seconds to wait. */
  take(key: string): number {
    const t = this.now();
    if (this.hits.size > 10_000) this.prune(t);
    const entry = this.hits.get(key);
    if (!entry || t - entry.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      return 0;
    }
    if (entry.count >= this.limit) return Math.max(1, Math.ceil((entry.start + this.windowMs - t) / 1000));
    entry.count++;
    return 0;
  }

  private prune(t: number) {
    for (const [key, entry] of this.hits) if (t - entry.start >= this.windowMs) this.hits.delete(key);
  }
}
