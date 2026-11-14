import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SerpApiGoogleFlightsAdapter } from "@/lib/flights/adapters/serpapi-google-flights";
import type { FlightSearchQuery } from "@/lib/flights/search-service";

describe("SerpApiGoogleFlightsAdapter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("correctly identifies when SERPAPI_API_KEY is configured", () => {
    delete process.env.SERPAPI_API_KEY;
    delete process.env.SERP_API_KEY;
    expect(SerpApiGoogleFlightsAdapter.isConfigured()).toBe(false);

    process.env.SERPAPI_API_KEY = "test_serp_key_123";
    expect(SerpApiGoogleFlightsAdapter.isConfigured()).toBe(true);
  });

  it("normalizes real SerpApi Google Flights response groups correctly", () => {
    const mockGroups = [
      {
        flights: [
          {
            departure_airport: { id: "DEL", name: "Indira Gandhi International", time: "2026-11-27 06:15" },
            arrival_airport: { id: "PNQ", name: "Pune International Airport", time: "2026-11-27 08:25" },
            duration: 130,
            airline: "IndiGo",
            flight_number: "6E 6884",
            airplane: "Airbus A320",
          },
        ],
        total_duration: 130,
        price: 5499,
      },
      {
        flights: [
          {
            departure_airport: { id: "DEL", name: "Indira Gandhi International", time: "2026-11-27 14:00" },
            arrival_airport: { id: "BOM", name: "Chhatrapati Shivaji Maharaj", time: "2026-11-27 16:10" },
            duration: 130,
            airline: "Air India",
            flight_number: "AI 865",
          },
          {
            departure_airport: { id: "BOM", name: "Chhatrapati Shivaji Maharaj", time: "2026-11-27 18:00" },
            arrival_airport: { id: "PNQ", name: "Pune International Airport", time: "2026-11-27 18:55" },
            duration: 55,
            airline: "Air India",
            flight_number: "AI 888",
          },
        ],
        total_duration: 295,
        price: 7800,
      },
    ];

    const query: FlightSearchQuery = {
      origin: "DEL",
      destination: "PNQ",
      departureDate: "2026-11-27",
      adults: 2,
      currency: "INR",
    };

    const offers = SerpApiGoogleFlightsAdapter.normalizeGoogleFlights(mockGroups, query);

    expect(offers.length).toBe(2);

    // First offer (Non-stop IndiGo)
    const first = offers[0];
    expect(first.airline).toBe("IndiGo");
    expect(first.airlineCode).toBe("6E");
    expect(first.flightNumber).toBe("6E 6884");
    expect(first.departureDate).toBe("2026-11-27");
    expect(first.departureTime).toBe("06:15");
    expect(first.arrivalTime).toBe("08:25");
    expect(first.stops).toBe(0);
    expect(first.stopsLabel).toBe("Non-stop");
    expect(first.pricePerAdult).toBe(5499);
    expect(first.price).toBe(10998); // 2 adults
    expect(first.priceStatus).toBe("LIVE_SEARCH_PRICE");

    // Second offer (1 Stop Air India via BOM)
    const second = offers[1];
    expect(second.airline).toBe("Air India");
    expect(second.airlineCode).toBe("AI");
    expect(second.stops).toBe(1);
    expect(second.stopsLabel).toBe("1 Stop");
    expect(second.segments.length).toBe(2);
    expect(second.segments[0].destination).toBe("BOM");
    expect(second.segments[1].destination).toBe("PNQ");
  });

  it("strictly filters out flights departing on mismatched dates", () => {
    const mismatchedGroup = [
      {
        flights: [
          {
            departure_airport: { id: "DEL", time: "2026-11-28 01:15" }, // Tomorrow instead of requested 27th
            arrival_airport: { id: "PNQ", time: "2026-11-28 03:25" },
            duration: 130,
            airline: "Akasa Air",
            flight_number: "QP 1102",
          },
        ],
        total_duration: 130,
        price: 4999,
      },
    ];

    const query: FlightSearchQuery = {
      origin: "DEL",
      destination: "PNQ",
      departureDate: "2026-11-27",
      adults: 1,
      currency: "INR",
    };

    const offers = SerpApiGoogleFlightsAdapter.normalizeGoogleFlights(mismatchedGroup, query);
    expect(offers.length).toBe(0);
  });
});
