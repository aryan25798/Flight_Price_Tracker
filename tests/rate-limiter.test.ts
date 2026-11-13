import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";

describe("SlidingWindowRateLimiter (PERF-01)", () => {
  it("allows requests under the limit", () => {
    const limiter = new SlidingWindowRateLimiter(5, 60_000);
    const ip = "192.168.1.10";

    for (let i = 0; i < 5; i++) {
      const res = limiter.check(ip);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - (i + 1));
    }
  });

  it("blocks requests that exceed the limit with 429 Retry-After", () => {
    const limiter = new SlidingWindowRateLimiter(3, 10_000);
    const ip = "10.0.0.1";

    // 3 requests allowed
    limiter.check(ip);
    limiter.check(ip);
    limiter.check(ip);

    // 4th request blocked
    const res = limiter.check(ip);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks different IPs independently", () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    limiter.check("ip-a");
    limiter.check("ip-a");

    expect(limiter.check("ip-a").allowed).toBe(false);
    expect(limiter.check("ip-b").allowed).toBe(true);
  });
});
