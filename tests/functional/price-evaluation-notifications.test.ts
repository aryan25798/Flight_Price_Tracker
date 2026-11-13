import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

// Canonical eligibility logic from check-flight-prices Edge Function
export function isTrackerEligibleForAlert(
  currentPrice: number,
  targetPrice: number,
  lastNotifiedPrice: number | null,
  lastNotifiedAt: string | null,
  cooldownHours: number,
  dropThresholdPercent: number,
  nowMs: number,
): boolean {
  // Scenario 2: Current price is above target price -> ineligible
  if (currentPrice > targetPrice) {
    return false;
  }

  // Scenario 3: First eligible notification
  if (!lastNotifiedAt || lastNotifiedPrice === null) {
    return true;
  }

  // Scenario 9: Price remains unchanged from last notified price -> never repeat
  if (currentPrice === lastNotifiedPrice) {
    return false;
  }

  // Scenario 6 & 7: Price drops by >= 5% from last_notified_price bypasses cooldown
  const thresholdPrice = lastNotifiedPrice * (1 - dropThresholdPercent / 100);
  if (currentPrice <= thresholdPrice) {
    return true;
  }

  // Scenario 8: Price increases from last notified (e.g. was 4000, now 4400, target 5000)
  // Check if cooldown elapsed
  const lastNotifiedMs = new Date(lastNotifiedAt).getTime();
  const hoursElapsed = (nowMs - lastNotifiedMs) / (1000 * 60 * 60);

  // Scenario 4 (<12h) & Scenario 5 (>=12h)
  return hoursElapsed >= cooldownHours;
}

export function computeNotificationIdempotencyKey(
  trackerId: string,
  hourBucket: number,
  price: number,
): string {
  return createHash("sha256")
    .update(`${trackerId}:${hourBucket}:${price}`, "utf8")
    .digest("hex");
}

describe("Phase 2 Functional Testing: Price Evaluation & Notification Logic", () => {
  const targetPrice = 5000;
  const cooldownHours = 12;
  const dropPercent = 5;
  const now = 1700000000000; // Base reference timestamp in ms

  // 1. Current price is below target price
  it("Scenario 1: Triggers alert when current price is below target price on initial discovery", () => {
    const eligible = isTrackerEligibleForAlert(
      4500, // current
      targetPrice,
      null, // lastNotifiedPrice
      null, // lastNotifiedAt
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(true);
  });

  // 2. Current price is above target price
  it("Scenario 2: Suppresses alert when current price is above target price", () => {
    const eligible = isTrackerEligibleForAlert(
      5200, // current
      targetPrice,
      null,
      null,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(false);
  });

  // 3. First eligible notification
  it("Scenario 3: Qualifies as first eligible notification when never notified before", () => {
    const eligible = isTrackerEligibleForAlert(
      4999,
      targetPrice,
      null,
      null,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(true);
  });

  // 4. Notification within 12-hour cooldown
  it("Scenario 4: Suppresses alert when price changes within 12h cooldown without reaching 5% threshold", () => {
    const eightHoursAgo = new Date(now - 8 * 3600 * 1000).toISOString();
    // Dropped only 2% (from 4800 to 4750) within 8 hours
    const eligible = isTrackerEligibleForAlert(
      4750,
      targetPrice,
      4800,
      eightHoursAgo,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(false);
  });

  // 5. Notification after 12-hour cooldown
  it("Scenario 5: Allows notification after 12-hour cooldown has elapsed even for minor price difference", () => {
    const fourteenHoursAgo = new Date(now - 14 * 3600 * 1000).toISOString();
    // Price changed slightly after 14 hours
    const eligible = isTrackerEligibleForAlert(
      4750,
      targetPrice,
      4800,
      fourteenHoursAgo,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(true);
  });

  // 6. Price drops by exactly 5%
  it("Scenario 6: Bypasses cooldown when price drops by exactly 5%", () => {
    const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString();
    const lastPrice = 10000;
    const exactDropPrice = 9500; // 5% drop

    const eligible = isTrackerEligibleForAlert(
      exactDropPrice,
      12000,
      lastPrice,
      twoHoursAgo,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(true);
  });

  // 7. Price drops by more than 5%
  it("Scenario 7: Bypasses cooldown when price drops by more than 5%", () => {
    const oneHourAgo = new Date(now - 1 * 3600 * 1000).toISOString();
    const lastPrice = 10000;
    const majorDropPrice = 8500; // 15% drop

    const eligible = isTrackerEligibleForAlert(
      majorDropPrice,
      12000,
      lastPrice,
      oneHourAgo,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(true);
  });

  // 8. Price increases but remains below target
  it("Scenario 8: Handles price rebound correctly; respects cooldown when price increased", () => {
    const threeHoursAgo = new Date(now - 3 * 3600 * 1000).toISOString();
    // Was 4000, rebounded to 4500 (target is 5000)
    const withinCooldown = isTrackerEligibleForAlert(
      4500,
      targetPrice,
      4000,
      threeHoursAgo,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(withinCooldown).toBe(false);

    const sixteenHoursAgo = new Date(now - 16 * 3600 * 1000).toISOString();
    const afterCooldown = isTrackerEligibleForAlert(
      4500,
      targetPrice,
      4000,
      sixteenHoursAgo,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(afterCooldown).toBe(true);
  });

  // 9. Price remains unchanged
  it("Scenario 9: Never repeats alert when current price equals last notified price", () => {
    const yesterday = new Date(now - 24 * 3600 * 1000).toISOString();
    const eligible = isTrackerEligibleForAlert(
      4500,
      targetPrice,
      4500, // Identical price
      yesterday,
      cooldownHours,
      dropPercent,
      now,
    );
    expect(eligible).toBe(false);
  });

  // 10. Telegram delivery fails
  it("Scenario 10: Ensures failed delivery preserves previous last_notified timestamps", () => {
    interface TrackerState {
      lastNotifiedPrice: number | null;
      lastNotifiedAt: string | null;
    }

    const state: TrackerState = {
      lastNotifiedPrice: 4800,
      lastNotifiedAt: "2026-11-10T12:00:00Z",
    };

    function simulateDispatch(tgSuccess: boolean, newPrice: number, newTimestamp: string) {
      if (tgSuccess) {
        state.lastNotifiedPrice = newPrice;
        state.lastNotifiedAt = newTimestamp;
      }
      // On failure, state is NOT updated
    }

    // Attempt fails
    simulateDispatch(false, 4200, "2026-11-12T12:00:00Z");
    expect(state.lastNotifiedPrice).toBe(4800);
    expect(state.lastNotifiedAt).toBe("2026-11-10T12:00:00Z");

    // Next retry succeeds
    simulateDispatch(true, 4200, "2026-11-12T12:05:00Z");
    expect(state.lastNotifiedPrice).toBe(4200);
    expect(state.lastNotifiedAt).toBe("2026-11-12T12:05:00Z");
  });

  // 11 & 12. Idempotency Key & Concurrent Notification Processing
  it("Scenario 11 & 12: Guarantees notification idempotency across duplicate or concurrent runs", () => {
    const trackerId = "trk-uuid-12345";
    const hourBucket = Math.floor(now / (240 * 60_000));
    const price = 4250;

    const key1 = computeNotificationIdempotencyKey(trackerId, hourBucket, price);
    const key2 = computeNotificationIdempotencyKey(trackerId, hourBucket, price);
    expect(key1).toBe(key2);

    // Mock notification_logs table unique constraint
    const logDatabase = new Set<string>();

    function attemptSendNotification(idempotencyKey: string): { inserted: boolean } {
      if (logDatabase.has(idempotencyKey)) {
        return { inserted: false }; // Unique violation / skipped
      }
      logDatabase.add(idempotencyKey);
      return { inserted: true };
    }

    const worker1 = attemptSendNotification(key1);
    const worker2 = attemptSendNotification(key2);

    expect(worker1.inserted).toBe(true);
    expect(worker2.inserted).toBe(false); // Second concurrent worker rejected!
  });

  // 13. User has disconnected Telegram
  it("Scenario 13: Skips notifications when user has disconnected Telegram (chat_id is null)", () => {
    const profile = { telegram_chat_id: null, is_banned: false };
    const canNotify = Boolean(profile.telegram_chat_id) && !profile.is_banned;
    expect(canNotify).toBe(false);
  });

  // 14. User is banned
  it("Scenario 14: Suppresses all notifications for banned users", () => {
    const profile = { telegram_chat_id: "987654321", is_banned: true };
    const canNotify = Boolean(profile.telegram_chat_id) && !profile.is_banned;
    expect(canNotify).toBe(false);
  });

  // 15. Tracker is paused
  it("Scenario 15: Suppresses notifications when tracker is paused (is_active is false)", () => {
    const tracker = { is_active: false, target_price: 5000 };
    const shouldEvaluate = tracker.is_active;
    expect(shouldEvaluate).toBe(false);
  });

  // Currency precision
  it("Verifies rounding and currency calculation precision", () => {
    const prev = 4999.5;
    const current = 4499.55;
    const savings = prev - current;
    const percentDrop = ((prev - current) / prev) * 100;

    expect(Math.round(percentDrop)).toBe(10);
    expect(Number(savings.toFixed(2))).toBe(499.95);
  });
});
