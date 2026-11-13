interface RateLimitRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private lastCleanup: number = Date.now();

  constructor(maxRequests = 30, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public check(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    this.cleanupIfNeeded(now);

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  private cleanupIfNeeded(now: number) {
    if (now - this.lastCleanup > 60_000) {
      const windowStart = now - this.windowMs;
      for (const [key, record] of this.store.entries()) {
        record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
        if (record.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
      this.lastCleanup = now;
    }
  }

  public reset() {
    this.store.clear();
  }
}

export const checkPriceRateLimiter = new SlidingWindowRateLimiter(30, 60_000);
