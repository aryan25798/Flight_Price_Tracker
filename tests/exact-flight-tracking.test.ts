import { describe, expect, it } from "vitest";
import { CreateTrackerSchema } from "@/lib/validations/tracker";
import { getTodayDateString, getTomorrowDateString } from "@/lib/dates/flight-datetime";
import type { TrackedFlight, FlightSearchSession } from "@/types/database";

describe("AeroDrop Exact Flight Tracking & Search Session Suite (Phase 2)", () => {
  const tomorrow = getTomorrowDateString();

  it("validates standard route-level tracker creation input", () => {
    const input = {
      origin: "del",
      destination: "pat",
      departureDate: tomorrow,
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 6500,
    };

    const res = CreateTrackerSchema.safeParse(input);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.origin).toBe("DEL");
      expect(res.data.destination).toBe("PAT");
      expect(res.data.trackingMode).toBe("route");
    }
  });

  it("validates exact flight itinerary tracker with airline, flight number, and times", () => {
    const input = {
      origin: "del",
      destination: "pat",
      departureDate: tomorrow,
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 7200,
      trackingMode: "exact_flight",
      flightNumber: "6E 6245",
      airlineCode: "6E",
      airlineName: "IndiGo",
      departureTime: "06:20",
      arrivalTime: "08:00",
      itineraryFingerprint: "opt_DEL_PAT_2026-11-15_6E_6245_0",
      bookingUrl: "https://www.aviasales.com/search/DEL1511PAT1",
    };

    const res = CreateTrackerSchema.safeParse(input);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.trackingMode).toBe("exact_flight");
      expect(res.data.flightNumber).toBe("6E 6245");
      expect(res.data.airlineCode).toBe("6E");
      expect(res.data.airlineName).toBe("IndiGo");
      expect(res.data.departureTime).toBe("06:20");
      expect(res.data.arrivalTime).toBe("08:00");
      expect(res.data.itineraryFingerprint).toBe("opt_DEL_PAT_2026-11-15_6E_6245_0");
    }
  });

  it("distinguishes between route-wide and exact-flight tracked objects", () => {
    const routeTracker: Partial<TrackedFlight> = {
      id: "trk-route-1",
      origin: "DEL",
      destination: "PAT",
      departure_date: tomorrow,
      tracking_mode: "route",
      flight_number: null,
    };

    const exactTracker: Partial<TrackedFlight> = {
      id: "trk-exact-1",
      origin: "DEL",
      destination: "PAT",
      departure_date: tomorrow,
      tracking_mode: "exact_flight",
      flight_number: "6E 6245",
      airline_code: "6E",
      airline_name: "IndiGo",
      departure_time: "06:20",
      arrival_time: "08:00",
      itinerary_fingerprint: "FP_DEL_PAT_6E_6245",
    };

    expect(routeTracker.tracking_mode).toBe("route");
    expect(exactTracker.tracking_mode).toBe("exact_flight");
    expect(exactTracker.flight_number).toBe("6E 6245");
    expect(exactTracker.itinerary_fingerprint).toBe("FP_DEL_PAT_6E_6245");
  });

  it("structures flight search session metadata correctly", () => {
    const session: FlightSearchSession = {
      id: "sess-12345",
      user_id: "user-123",
      origin: "DEL",
      destination: "PAT",
      departure_date: tomorrow,
      return_date: null,
      trip_type: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabin_class: "economy",
      currency: "INR",
      direct_only: true,
      provider: "travelpayouts",
      total_offers: 5,
      best_price: 6692,
      price_status: "CACHED_PRICE",
      offers: [
        {
          id: "opt_1",
          airline: "IndiGo",
          flightNumber: "6245",
          price: 6692,
        },
      ],
      search_metadata: {
        latencyMs: 145,
        cachedAt: new Date().toISOString(),
      },
      expires_at: new Date(Date.now() + 1800_000).toISOString(),
      created_at: new Date().toISOString(),
    };

    expect(session.id).toBe("sess-12345");
    expect(session.total_offers).toBe(5);
    expect(session.price_status).toBe("CACHED_PRICE");
    expect(session.offers).toHaveLength(1);
  });
});
