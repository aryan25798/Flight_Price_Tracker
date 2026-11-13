import { describe, expect, it } from "vitest";
import { formatCurrency, formatDateShort } from "@/lib/utils";

export type TrackerNotificationDecision =
  | { eligible: true; type: "price_drop"; isUrgent: boolean }
  | { eligible: true; type: "status_update"; isUrgent: false }
  | { eligible: false; reason: string };

function evaluateTrackerNotification(
  currentPrice: number,
  targetPrice: number,
  lastNotifiedPrice: number | null,
  lastNotifiedAt: string | null,
  cooldownHours: number,
  dropThresholdPercent: number,
  nowMs: number,
): TrackerNotificationDecision {
  const lastNotifiedMs = lastNotifiedAt ? new Date(lastNotifiedAt).getTime() : 0;
  const hoursSinceLastAlert = lastNotifiedAt ? (nowMs - lastNotifiedMs) / (1000 * 60 * 60) : 9999;

  // Case 1: Price is at or below target price -> Urgent Flash Alert
  if (currentPrice <= targetPrice) {
    if (!lastNotifiedAt || lastNotifiedPrice === null) {
      return { eligible: true, type: "price_drop", isUrgent: true };
    }

    const dropThreshold = lastNotifiedPrice * (1 - dropThresholdPercent / 100);
    if (currentPrice <= dropThreshold) {
      return { eligible: true, type: "price_drop", isUrgent: true };
    }

    if (currentPrice < lastNotifiedPrice) {
      return { eligible: true, type: "price_drop", isUrgent: true };
    }

    if (hoursSinceLastAlert >= cooldownHours) {
      return { eligible: true, type: "price_drop", isUrgent: false };
    }

    return { eligible: false, reason: "price_drop_cooldown_active" };
  }

  // Case 2: Price is above target -> 4-Hour Routine Heartbeat Status Update
  if (!lastNotifiedAt || hoursSinceLastAlert >= 3.5) {
    return { eligible: true, type: "status_update", isUrgent: false };
  }

  return { eligible: false, reason: "routine_update_cooldown_active" };
}

describe("Enhanced Price Alert & 4-Hour Heartbeat Evaluation Rules", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");

  it("triggers urgent flash price_drop alert when currentPrice <= targetPrice on first check", () => {
    const res = evaluateTrackerNotification(6150, 6422, null, null, 12, 5, now);
    expect(res.eligible).toBe(true);
    if (res.eligible) {
      expect(res.type).toBe("price_drop");
      expect(res.isUrgent).toBe(true);
    }
  });

  it("triggers 4-hour routine status_update when currentPrice > targetPrice and no previous alert was sent", () => {
    const res = evaluateTrackerNotification(6760, 6422, null, null, 12, 5, now);
    expect(res.eligible).toBe(true);
    if (res.eligible) {
      expect(res.type).toBe("status_update");
      expect(res.isUrgent).toBe(false);
    }
  });

  it("triggers 4-hour routine status_update when currentPrice > targetPrice after 4 hours have elapsed", () => {
    const fourHoursAgo = new Date(now - 4 * 3600_000).toISOString();
    const res = evaluateTrackerNotification(6760, 6422, 6760, fourHoursAgo, 12, 5, now);
    expect(res.eligible).toBe(true);
    if (res.eligible) {
      expect(res.type).toBe("status_update");
    }
  });

  it("throttles duplicate status_update when less than 3.5 hours have elapsed", () => {
    const oneHourAgo = new Date(now - 1 * 3600_000).toISOString();
    const res = evaluateTrackerNotification(6760, 6422, 6760, oneHourAgo, 12, 5, now);
    expect(res.eligible).toBe(false);
  });

  it("bypasses routine status and sends urgent flash price_drop when fares finally drop below target", () => {
    const twoHoursAgo = new Date(now - 2 * 3600_000).toISOString();
    // Prior status update sent at 6760, now fare dropped to 6150 (below target 6422)
    const res = evaluateTrackerNotification(6150, 6422, 6760, twoHoursAgo, 12, 5, now);
    expect(res.eligible).toBe(true);
    if (res.eligible) {
      expect(res.type).toBe("price_drop");
      expect(res.isUrgent).toBe(true);
    }
  });
});

describe("Formatting Utilities", () => {
  it("formats INR and USD currencies cleanly", () => {
    expect(formatCurrency(9400, "INR")).toContain("9,400");
    expect(formatCurrency(250, "USD")).toContain("$250");
    expect(formatCurrency(null, "INR")).toBe("—");
  });

  it("formats ISO dates cleanly", () => {
    expect(formatDateShort("2026-12-15")).toBe("15 Dec 2026");
  });
});
