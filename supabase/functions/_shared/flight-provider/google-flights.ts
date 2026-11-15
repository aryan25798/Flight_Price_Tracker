import {
  type FlightProvider,
  FlightProviderError,
  type FlightSearchQuery,
  type NormalizedFlightOffer,
  type ProviderCapabilities,
} from "./types.ts";

export class GoogleFlightsProvider implements FlightProvider {
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey ?? Deno.env.get("SERPAPI_API_KEY");
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  getProviderName(): string {
    return "google_flights";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsPassengerFilter: true,
      supportsCabinFilter: true,
      isCachedData: false,
    };
  }

  async searchFlights(query: FlightSearchQuery): Promise<NormalizedFlightOffer | null> {
    const key = this.apiKey || Deno.env.get("SERPAPI_API_KEY");
    if (!key) {
      // In development or if no SerpApi key is present, log and return null without crashing
      console.warn("GoogleFlightsProvider: SERPAPI_API_KEY is not configured, skipping SerpApi query");
      return null;
    }

    const serpUrl = new URL("https://serpapi.com/search");
    serpUrl.searchParams.set("engine", "google_flights");
    serpUrl.searchParams.set("departure_id", query.origin.toUpperCase());
    serpUrl.searchParams.set("arrival_id", query.destination.toUpperCase());
    serpUrl.searchParams.set("outbound_date", query.departureDate);
    if (query.tripType === "round_trip" && query.returnDate) {
      serpUrl.searchParams.set("return_date", query.returnDate);
      serpUrl.searchParams.set("type", "1");
    } else {
      serpUrl.searchParams.set("type", "2");
    }
    serpUrl.searchParams.set("adults", String(query.adults || 1));
    serpUrl.searchParams.set("currency", (query.currency || "INR").toUpperCase());
    serpUrl.searchParams.set("api_key", key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(serpUrl.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new FlightProviderError(
          `SerpApi Google Flights HTTP ${res.status}: ${res.statusText}`,
          res.status >= 500 || res.status === 429,
          res.status
        );
      }

      const data = await res.json();
      return this.normalizeResponse(data, query);
    } catch (err) {
      if (err instanceof FlightProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new FlightProviderError("SerpApi request timed out", true, 408);
      }
      throw new FlightProviderError(
        err instanceof Error ? err.message : "SerpApi search failure",
        true
      );
    } finally {
      clearTimeout(timer);
    }
  }

  validateResponse(raw: unknown): unknown {
    return raw;
  }

  normalizeResponse(raw: any, query: FlightSearchQuery): NormalizedFlightOffer | null {
    if (!raw || typeof raw !== "object") return null;

    const flights = [
      ...(Array.isArray(raw.best_flights) ? raw.best_flights : []),
      ...(Array.isArray(raw.other_flights) ? raw.other_flights : []),
    ];

    if (flights.length === 0) return null;

    // Sort by price ascending
    const valid = flights.filter((f) => typeof f.price === "number" && f.price > 0);
    if (valid.length === 0) return null;

    valid.sort((a, b) => a.price - b.price);
    const top = valid[0];
    const firstLeg = top.flights?.[0];
    const totalLegs = top.flights?.length || 1;

    const departureTime = firstLeg?.departure_airport?.time || "00:00";
    const departureAt = `${query.departureDate}T${departureTime}:00`;

    return {
      price: top.price,
      currency: (query.currency || "INR").toUpperCase(),
      airline: firstLeg?.airline || "Available Airline",
      flightNumber: firstLeg?.flight_number || null,
      departureAt,
      returnAt: query.returnDate ? `${query.returnDate}T00:00:00` : null,
      transfers: Math.max(0, totalLegs - 1),
      bookingUrl: this.getBookingUrl(null, query),
      provider: "google_flights",
    };
  }

  getBookingUrl(_rawLink: string | undefined | null, query: FlightSearchQuery): string {
    return `https://www.google.com/travel/flights?q=Flights%20to%20${encodeURIComponent(
      query.destination.toUpperCase()
    )}%20from%20${encodeURIComponent(query.origin.toUpperCase())}%20on%20${encodeURIComponent(
      query.departureDate
    )}`;
  }
}
