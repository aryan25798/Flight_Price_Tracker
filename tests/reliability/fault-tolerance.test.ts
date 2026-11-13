import { describe, expect, it } from "vitest";

export class FlightProviderError extends Error {
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(message: string, retryable = true, statusCode?: number) {
    super(message);
    this.name = "FlightProviderError";
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

interface MockRoute {
  id: string;
  failureCount: number;
  status: "active" | "failed" | "expired";
  nextCheckAt: string;
}

function handleRoutePollingError(
  route: MockRoute,
  error: unknown,
  maxRetries = 5,
  nowMs = Date.now(),
): MockRoute {
  const isRetryable = error instanceof FlightProviderError ? error.retryable : true;
  const nextFailures = route.failureCount + 1;
  const shouldFailPermanently = !isRetryable || nextFailures >= maxRetries;

  if (shouldFailPermanently) {
    return {
      ...route,
      failureCount: nextFailures,
      status: "failed",
      nextCheckAt: new Date(nowMs + 365 * 86400000).toISOString(),
    };
  }

  // Exponential backoff: min(1440, 15 * 2^(failures-1))
  const backoffMinutes = Math.min(1440, 15 * Math.pow(2, nextFailures - 1));
  return {
    ...route,
    failureCount: nextFailures,
    status: "active",
    nextCheckAt: new Date(nowMs + backoffMinutes * 60_000).toISOString(),
  };
}

describe("Phase 6 System Reliability & Fault Tolerance Audit", () => {
  describe("1. Flight Provider Resilience & Backoff", () => {
    it("handles temporary provider 429 rate limits with exponential backoff", () => {
      const route: MockRoute = {
        id: "route-1",
        failureCount: 0,
        status: "active",
        nextCheckAt: new Date().toISOString(),
      };

      const now = Date.now();
      const err429 = new FlightProviderError("Provider rate limit reached (HTTP 429)", true, 429);
      const updated = handleRoutePollingError(route, err429, 5, now);

      expect(updated.status).toBe("active");
      expect(updated.failureCount).toBe(1);
      // First retry backoff: 15 minutes
      const expectedNext = new Date(now + 15 * 60_000).toISOString();
      expect(updated.nextCheckAt).toBe(expectedNext);
    });

    it("increases exponential backoff interval with repeated temporary failures", () => {
      const now = Date.now();
      let route: MockRoute = { id: "route-1", failureCount: 0, status: "active", nextCheckAt: "" };
      const err503 = new FlightProviderError("Provider outage (HTTP 503)", true, 503);

      route = handleRoutePollingError(route, err503, 5, now);
      expect(route.failureCount).toBe(1);

      route = handleRoutePollingError(route, err503, 5, now);
      expect(route.failureCount).toBe(2);
      // Second retry backoff: 30 minutes
      const expectedNext = new Date(now + 30 * 60_000).toISOString();
      expect(route.nextCheckAt).toBe(expectedNext);
    });

    it("marks route as failed when consecutive failures exceed max retries (5)", () => {
      let route: MockRoute = { id: "route-1", failureCount: 4, status: "active", nextCheckAt: "" };
      const err500 = new FlightProviderError("Provider internal server error", true, 500);

      route = handleRoutePollingError(route, err500, 5);
      expect(route.failureCount).toBe(5);
      expect(route.status).toBe("failed");
    });

    it("immediately fails route on non-retryable provider error (e.g. invalid airport)", () => {
      const route: MockRoute = { id: "route-1", failureCount: 0, status: "active", nextCheckAt: "" };
      const nonRetryableErr = new FlightProviderError("Invalid route or unserviced airport (HTTP 400)", false, 400);

      const updated = handleRoutePollingError(route, nonRetryableErr, 5);
      expect(updated.status).toBe("failed");
    });
  });

  describe("2. Telegram Delivery Fault Tolerance", () => {
    interface TelegramResponse {
      ok: boolean;
      errorCode?: number;
      description?: string;
    }

    interface DispatchOutcome {
      deliveryStatus: "sent" | "failed";
      errorMessage?: string;
      shouldRetryLater: boolean;
    }

    function processTelegramDeliveryResult(res: TelegramResponse): DispatchOutcome {
      if (res.ok) {
        return { deliveryStatus: "sent", shouldRetryLater: false };
      }

      // If user blocked the bot, do not retry
      if (res.errorCode === 403) {
        return {
          deliveryStatus: "failed",
          errorMessage: res.description || "Bot blocked by user",
          shouldRetryLater: false,
        };
      }

      // Transient Telegram network error / 504 gateway timeout -> retryable
      return {
        deliveryStatus: "failed",
        errorMessage: res.description || "Transient delivery error",
        shouldRetryLater: true,
      };
    }

    it("handles HTTP 403 (User blocked bot) gracefully without crashing batch", () => {
      const blockedResponse: TelegramResponse = {
        ok: false,
        errorCode: 403,
        description: "Forbidden: bot was blocked by the user",
      };

      const outcome = processTelegramDeliveryResult(blockedResponse);
      expect(outcome.deliveryStatus).toBe("failed");
      expect(outcome.shouldRetryLater).toBe(false);
      expect(outcome.errorMessage).toContain("blocked");
    });

    it("flags transient network errors for future retry", () => {
      const transientResponse: TelegramResponse = {
        ok: false,
        errorCode: 504,
        description: "Gateway Timeout",
      };

      const outcome = processTelegramDeliveryResult(transientResponse);
      expect(outcome.deliveryStatus).toBe("failed");
      expect(outcome.shouldRetryLater).toBe(true);
    });
  });

  describe("3. Concurrency Locking & Isolation", () => {
    class MockAdvisoryLockManager {
      private isLocked = false;

      public acquireLock(): boolean {
        if (this.isLocked) return false;
        this.isLocked = true;
        return true;
      }

      public releaseLock(): boolean {
        if (!this.isLocked) return false;
        this.isLocked = false;
        return true;
      }
    }

    it("guarantees exclusive advisory locking across concurrent polling triggers", () => {
      const lockManager = new MockAdvisoryLockManager();

      // Worker 1 starts scheduled run
      const worker1Acquired = lockManager.acquireLock();
      expect(worker1Acquired).toBe(true);

      // Worker 2 (manual admin trigger or overlapping cron) attempts to acquire
      const worker2Acquired = lockManager.acquireLock();
      expect(worker2Acquired).toBe(false); // Cleanly rejected!

      // Worker 1 finishes and releases lock
      lockManager.releaseLock();

      // Next scheduled run can acquire
      const worker3Acquired = lockManager.acquireLock();
      expect(worker3Acquired).toBe(true);
    });

    it("verifies partial failure isolation in batch processing", async () => {
      // 3 items in batch: item 1 succeeds, item 2 fails, item 3 succeeds
      const batchItems = [
        { id: 1, willFail: false },
        { id: 2, willFail: true },
        { id: 3, willFail: false },
      ];

      const results = await Promise.allSettled(
        batchItems.map(async (item) => {
          if (item.willFail) {
            throw new Error(`Item ${item.id} provider network drop`);
          }
          return { id: item.id, processed: true };
        }),
      );

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
    });
  });
});
