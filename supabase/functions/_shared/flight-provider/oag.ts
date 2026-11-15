import {
  type FlightProvider,
  FlightProviderError,
  type FlightSearchQuery,
  type NormalizedFlightOffer,
  type ProviderCapabilities,
} from "./types.ts";

export interface OAGFlightDetails {
  carrierIata: string;
  carrierIcao?: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureTimeLocal?: string;
  arrivalTimeLocal?: string;
  elapsedMinutes?: number;
  aircraftIata?: string;
  aircraftName?: string;
}

export class OAGProvider implements FlightProvider {
  private readonly flightInfoKey: string | undefined;
  private readonly connectionsKey: string | undefined;

  constructor(options?: { flightInfoKey?: string; connectionsKey?: string }) {
    this.flightInfoKey =
      options?.flightInfoKey ??
      Deno.env.get("OAG_FLIGHT_INFO_KEY") ??
      Deno.env.get("OAG_API_KEY");
    this.connectionsKey =
      options?.connectionsKey ??
      Deno.env.get("OAG_FLIGHT_CONNECTIONS_KEY") ??
      this.flightInfoKey;
  }

  getProviderName(): string {
    return "oag";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsPassengerFilter: false,
      supportsCabinFilter: false,
      isCachedData: false,
    };
  }

  async searchFlights(query: FlightSearchQuery): Promise<NormalizedFlightOffer | null> {
    const key = this.flightInfoKey ?? Deno.env.get("OAG_FLIGHT_INFO_KEY");
    if (!key) {
      console.warn("OAGProvider: OAG_FLIGHT_INFO_KEY is not configured");
      return null;
    }

    try {
      const origin = query.origin.toUpperCase();
      const destination = query.destination.toUpperCase();
      const url = `https://api.oag.com/flight-instances?DepartureAirport=${encodeURIComponent(
        origin
      )}&ArrivalAirport=${encodeURIComponent(
        destination
      )}&DepartureDateTime=${encodeURIComponent(query.departureDate)}&CodeType=IATA&version=v2`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Subscription-Key": key,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new FlightProviderError(
          `OAG HTTP ${res.status}: ${res.statusText}`,
          res.status >= 500 || res.status === 429,
          res.status
        );
      }

      const body = await res.json();
      return this.normalizeResponse(body, query);
    } catch (err) {
      if (err instanceof FlightProviderError) throw err;
      return null;
    }
  }

  validateResponse(raw: unknown): unknown {
    return raw;
  }

  normalizeResponse(raw: any, query: FlightSearchQuery): NormalizedFlightOffer | null {
    if (!raw || !Array.isArray(raw.data) || raw.data.length === 0) {
      return null;
    }

    const instance = raw.data[0];
    const carrierIata = instance.carrier?.iata || "6E";
    const flightNumber = instance.flightNumber ? `${carrierIata} ${instance.flightNumber}` : null;
    const departureTime = instance.departure?.time?.local || "00:00";
    const departureAt = `${query.departureDate}T${departureTime}`;

    return {
      price: 0, // OAG provides flight schedules, equipment, and status; pricing is matched with fare providers
      currency: (query.currency || "INR").toUpperCase(),
      airline: carrierIata,
      flightNumber,
      departureAt,
      returnAt: query.returnDate ? `${query.returnDate}T00:00:00` : null,
      transfers: 0,
      bookingUrl: this.getBookingUrl(null, query),
      provider: "oag",
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
