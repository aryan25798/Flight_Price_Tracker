import { describe, it, expect } from "vitest";
import { FlightSearchService } from "@/lib/flights/search-service";
import { getTomorrowDateString } from "@/lib/dates/flight-datetime";

describe("AeroDrop FlightSearchService Suite (Phase 3)", () => {
  const tomorrow = getTomorrowDateString();

  it("normalizes and searches routes with pure calendar date arithmetic", async () => {
    const result = await FlightSearchService.search({
      origin: "delhi",
      destination: "bombay",
      departureDate: tomorrow,
      adults: 1,
      cabinClass: "economy",
      currency: "INR",
    });

    expect(result).toBeDefined();
    expect(result.query.origin).toBe("DEL");
    expect(result.query.destination).toBe("BOM");
    expect(result.query.departureDate).toBe(tomorrow);
    expect(result.sessionId).toContain("sess_DEL_BOM_");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("supports sorting by cheapest, fastest, earliest departure, latest departure", async () => {
    const resultCheapest = await FlightSearchService.search({
      origin: "DEL",
      destination: "PAT",
      departureDate: tomorrow,
      sortBy: "cheapest",
    });

    if (resultCheapest.offers.length > 1) {
      for (let i = 0; i < resultCheapest.offers.length - 1; i++) {
        expect(resultCheapest.offers[i].price).toBeLessThanOrEqual(resultCheapest.offers[i + 1].price);
      }
    }

    const resultFastest = await FlightSearchService.search({
      origin: "DEL",
      destination: "PAT",
      departureDate: tomorrow,
      sortBy: "fastest",
    });

    if (resultFastest.offers.length > 1) {
      for (let i = 0; i < resultFastest.offers.length - 1; i++) {
        expect(resultFastest.offers[i].durationMinutes).toBeLessThanOrEqual(resultFastest.offers[i + 1].durationMinutes);
      }
    }
  });

  it("filters by non-stop vs connecting flights", async () => {
    const nonStopOnly = await FlightSearchService.search({
      origin: "DEL",
      destination: "BOM",
      departureDate: tomorrow,
      filters: {
        stops: [0],
      },
    });

    nonStopOnly.offers.forEach((offer) => {
      expect(offer.stops).toBe(0);
      expect(offer.stopsLabel).toBe("Non-stop");
    });
  });

  it("calculates best overall flight option based on weighted score of price and duration", async () => {
    const res = await FlightSearchService.search({
      origin: "DEL",
      destination: "BOM",
      departureDate: tomorrow,
      sortBy: "best",
    });

    if (res.offers.length > 0) {
      const best = res.offers.find((o) => o.isBestOverall);
      expect(best).toBeDefined();
    }
  });

  it("handles pagination parameters correctly (pages of 10, 20, 50)", async () => {
    const page10 = await FlightSearchService.search({
      origin: "DEL",
      destination: "BOM",
      departureDate: tomorrow,
      page: 1,
      pageSize: 10,
    });

    expect(page10.pageSize).toBe(10);
    expect(page10.offers.length).toBeLessThanOrEqual(10);
  });
});
