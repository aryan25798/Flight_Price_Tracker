import { describe, it, expect, vi, beforeEach } from "vitest";
import manifest from "@/app/manifest";
import {
  buildRoutineStatusUpdateEmail,
  buildPriceDropEmail,
  buildTrackerCreatedEmail,
} from "@/lib/email/smtp";

describe("AeroDrop PWA Web Manifest", () => {
  it("provides valid standalone PWA metadata with dark theme styling", () => {
    const config = manifest();
    expect(config.name).toBe("AeroDrop — Autonomous Flight Price Radar");
    expect(config.short_name).toBe("AeroDrop");
    expect(config.display).toBe("standalone");
    expect(config.background_color).toBe("#060913");
    expect(config.theme_color).toBe("#0284c7");
    expect(config.start_url).toBe("/dashboard");
    expect(config.icons).toBeDefined();
    expect(config.icons?.length).toBeGreaterThanOrEqual(2);

    const iconSizes = config.icons?.map((i) => i.sizes);
    expect(iconSizes).toContain("192x192");
    expect(iconSizes).toContain("512x512");
  });

  it("contains navigation shortcuts for fast access", () => {
    const config = manifest();
    expect(config.shortcuts).toBeDefined();
    const urls = config.shortcuts?.map((s) => s.url);
    expect(urls).toContain("/dashboard");
    expect(urls).toContain("/dashboard/trackers");
    expect(urls).toContain("/dashboard/notifications");
  });
});

describe("AeroDrop Multi-Channel Email Templates", () => {
  it("builds 4-hour routine scan status email with route diff and booking CTA", () => {
    const html = buildRoutineStatusUpdateEmail({
      origin: "DEL",
      destination: "BOM",
      departureDate: "2026-12-15",
      returnDate: "2026-12-22",
      airline: "IndiGo",
      currentPrice: 5200,
      targetPrice: 4800,
      currency: "INR",
      bookingUrl: "https://aerodrop.io/book/test",
      dashboardUrl: "https://aerodrop.io/dashboard",
    });

    expect(html).toContain("4-HOUR RADAR SCAN UPDATE");
    expect(html).toContain("DEL");
    expect(html).toContain("BOM");
    expect(html).toContain("IndiGo");
    expect(html).toContain("5,200");
    expect(html).toContain("4,800");
    expect(html).toContain("INR 400 above target");
    expect(html).toContain("BOOK CURRENT FARE ON SELLER SITE");
  });

  it("highlights 'At or Below Target!' in routine scan when price matches threshold", () => {
    const html = buildRoutineStatusUpdateEmail({
      origin: "JFK",
      destination: "LHR",
      departureDate: "2026-11-20",
      currentPrice: 450,
      targetPrice: 500,
      currency: "USD",
    });

    expect(html).toContain("🔥 At or Below Target!");
    expect(html).toContain("USD 450");
  });

  it("builds urgent price drop flash alert email with discount savings", () => {
    const html = buildPriceDropEmail({
      origin: "BLR",
      destination: "DXB",
      departureDate: "2026-12-01",
      airline: "Emirates",
      currentPrice: 14000,
      targetPrice: 18000,
      currency: "INR",
      bookingUrl: "https://emirates.com/deal",
    });

    expect(html).toContain("HURRY UP! PRICE DROP ALERT");
    expect(html).toContain("14,000");
    expect(html).toContain("18,000");
    expect(html).toContain("INR 4,000 (22% OFF)");
    expect(html).toContain("Emirates");
    expect(html).toContain("BOOK LOWEST FARE DIRECTLY NOW");
  });

  it("builds tracker creation confirmation email with 3D card layout", () => {
    const html = buildTrackerCreatedEmail({
      origin: "BOM",
      destination: "SIN",
      departureDate: "2027-01-10",
      targetPrice: 12000,
      currency: "INR",
    });

    expect(html).toContain("RADAR MONITOR ACTIVATED");
    expect(html).toContain("Price Drop Tracker is Live");
    expect(html).toContain("BOM");
    expect(html).toContain("SIN");
    expect(html).toContain("12,000");
    expect(html).toContain("VIEW LIVE RADAR IN DASHBOARD");
  });
});
