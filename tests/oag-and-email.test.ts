import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OAGAdapter } from "@/lib/flights/adapters/oag";
import { getAppUrl } from "@/lib/utils";
import { buildTrackerCreatedEmail, buildPriceDropEmail } from "@/lib/email/smtp";

describe("OAG Aviation Intelligence & Email Canonical Redirection Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Canonical getAppUrl & Email Redirect Links", () => {
    it("prioritizes canonical production URL over deployment-specific preview URLs on Vercel", () => {
      process.env.VERCEL = "1";
      process.env.VERCEL_URL = "flight-price-tracker-git-main-aryan25798.vercel.app";
      delete process.env.NEXT_PUBLIC_APP_URL;

      const url = getAppUrl();
      // Must return production domain to prevent Vercel preview/SSO wall
      expect(url).toBe("https://flight-price-tracker-nu.vercel.app");
    });

    it("respects NEXT_PUBLIC_APP_URL when explicitly configured", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://custom-domain.com/";
      expect(getAppUrl()).toBe("https://custom-domain.com");
    });

    it("ensures buildTrackerCreatedEmail generates links pointing to /dashboard", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://flight-price-tracker-nu.vercel.app";
      const html = buildTrackerCreatedEmail({
        origin: "DEL",
        destination: "PNQ",
        departureDate: "2026-11-20",
        targetPrice: 6500,
        currency: "INR",
      });

      expect(html).toContain("https://flight-price-tracker-nu.vercel.app/dashboard?origin=DEL&destination=PNQ");
      expect(html).toContain("VIEW LIVE RADAR IN DASHBOARD");
      // Must not contain vercel.com authentication URLs
      expect(html).not.toContain("https://vercel.com");
    });

    it("ensures buildPriceDropEmail generates direct dashboard URL and deep links", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://flight-price-tracker-nu.vercel.app";
      const html = buildPriceDropEmail({
        origin: "DEL",
        destination: "PNQ",
        departureDate: "2026-11-20",
        currentPrice: 5800,
        targetPrice: 6500,
        currency: "INR",
      });

      expect(html).toContain("https://flight-price-tracker-nu.vercel.app/dashboard?origin=DEL&destination=PNQ");
      expect(html).not.toContain("https://vercel.com");
    });
  });

  describe("OAGAdapter Configuration & Aircraft Resolution", () => {
    it("resolves popular IATA/ICAO equipment codes to passenger-friendly aircraft models", () => {
      expect(OAGAdapter.resolveAircraftName("32Q", "A21N")).toBe("Airbus A321neo");
      expect(OAGAdapter.resolveAircraftName("32N", "A20N")).toBe("Airbus A320neo");
      expect(OAGAdapter.resolveAircraftName("738", "B738")).toBe("Boeing 737-800");
      expect(OAGAdapter.resolveAircraftName("77W", "B77W")).toBe("Boeing 777-300ER");
      expect(OAGAdapter.resolveAircraftName("788", "B788")).toBe("Boeing 787-8 Dreamliner");
      expect(OAGAdapter.resolveAircraftName("359", "A359")).toBe("Airbus A350-900");
    });

    it("correctly identifies when OAG keys are configured", () => {
      process.env.OAG_FLIGHT_INFO_KEY = "test_flight_info_key";
      process.env.OAG_FLIGHT_CONNECTIONS_KEY = "test_conn_key";
      process.env.OAG_MASTER_DATA_KEY = "test_master_key";

      expect(OAGAdapter.isFlightInfoConfigured()).toBe(true);
      expect(OAGAdapter.isConnectionsConfigured()).toBe(true);
      expect(OAGAdapter.isMasterDataConfigured()).toBe(true);
    });

    it("returns null or empty array gracefully when OAG keys are absent", async () => {
      delete process.env.OAG_FLIGHT_INFO_KEY;
      delete process.env.OAG_API_KEY;
      delete process.env.OAG_FLIGHT_CONNECTIONS_KEY;
      delete process.env.OAG_MASTER_DATA_KEY;

      const details = await OAGAdapter.lookupFlightDetails({
        carrierCode: "6E",
        flightNumber: "2343",
        departureDate: "2026-11-20",
      });
      expect(details).toBeNull();

      const routes = await OAGAdapter.lookupRouteInstances({
        origin: "DEL",
        destination: "PNQ",
        departureDate: "2026-11-20",
      });
      expect(routes).toEqual([]);
    });
  });
});
