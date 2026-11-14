import type { FlightSearchQuery, NormalizedFlightOffer, FlightSegment } from "../search-service";
import { formatCurrency } from "@/lib/utils";
import { calculateFlightTimeline } from "@/lib/dates/flight-datetime";
import { getAirportDetails } from "../airport-resolver";

/**
 * Amadeus GDS Live Flight Offers Adapter
 *
 * Connects to Amadeus Self-Service Flight Offers Search API (2,000 free requests/month).
 * Provides live airline inventory across 400+ global airlines with exact flight schedules,
 * layover durations, bookable seats, and real-time fares.
 */
export class AmadeusAdapter {
  private static tokenCache: { token: string; expiresAt: number } | null = null;

  public static isConfigured(): boolean {
    const id = process.env.AMADEUS_CLIENT_ID || process.env.AMADEUS_API_KEY;
    const secret = process.env.AMADEUS_CLIENT_SECRET || process.env.AMADEUS_API_SECRET;
    return Boolean(id && secret);
  }

  private static async getAccessToken(): Promise<string | null> {
    const id = process.env.AMADEUS_CLIENT_ID || process.env.AMADEUS_API_KEY;
    const secret = process.env.AMADEUS_CLIENT_SECRET || process.env.AMADEUS_API_SECRET;
    if (!id || !secret) return null;

    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const host = process.env.AMADEUS_ENV === "production"
      ? "https://api.amadeus.com"
      : "https://test.api.amadeus.com";

    try {
      const res = await fetch(`${host}/v1/security/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: id.trim(),
          client_secret: secret.trim(),
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access_token) return null;

      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + ((data.expires_in || 1800) - 60) * 1000,
      };

      return data.access_token;
    } catch {
      return null;
    }
  }

  public static async searchFlights(params: FlightSearchQuery): Promise<NormalizedFlightOffer[]> {
    const token = await this.getAccessToken();
    if (!token) return [];

    const host = process.env.AMADEUS_ENV === "production"
      ? "https://api.amadeus.com"
      : "https://test.api.amadeus.com";

    const u = new URL(`${host}/v2/shopping/flight-offers`);
    u.searchParams.set("originLocationCode", params.origin.toUpperCase());
    u.searchParams.set("destinationLocationCode", params.destination.toUpperCase());
    u.searchParams.set("departureDate", params.departureDate);
    if (params.tripType === "round_trip" && params.returnDate) {
      u.searchParams.set("returnDate", params.returnDate);
    }
    u.searchParams.set("adults", String(params.adults || 1));
    u.searchParams.set("currencyCode", (params.currency || "INR").toUpperCase());
    u.searchParams.set("max", String(params.pageSize || 30));
    if (params.directOnly) {
      u.searchParams.set("nonStop", "true");
    }

    try {
      const res = await fetch(u.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) return [];
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) return [];

      return this.normalizeAmadeusOffers(data.data, params);
    } catch {
      return [];
    }
  }

  private static normalizeAmadeusOffers(
    rawOffers: Array<Record<string, unknown>>,
    query: FlightSearchQuery
  ): NormalizedFlightOffer[] {
    const offers: NormalizedFlightOffer[] = [];
    const originInfo = getAirportDetails(query.origin);
    const destInfo = getAirportDetails(query.destination);

    rawOffers.forEach((raw, idx) => {
      try {
        const itineraries = (raw.itineraries as Array<{
          duration: string;
          segments: Array<{
            departure: { iataCode: string; terminal?: string; at: string };
            arrival: { iataCode: string; terminal?: string; at: string };
            carrierCode: string;
            number: string;
            duration: string;
            numberOfStops: number;
          }>;
        }>) || [];

        if (itineraries.length === 0 || !itineraries[0].segments || itineraries[0].segments.length === 0) {
          return;
        }

        const outbound = itineraries[0];
        const firstSegment = outbound.segments[0];
        const lastSegment = outbound.segments[outbound.segments.length - 1];

        const rawPriceObj = raw.price as { total?: string; grandTotal?: string; currency?: string } | undefined;
        const totalPrice = Number(rawPriceObj?.grandTotal || rawPriceObj?.total || 0);
        if (isNaN(totalPrice) || totalPrice <= 0) return;

        const airlineCode = firstSegment.carrierCode;
        const flightNumber = `${airlineCode} ${firstSegment.number}`;
        const stops = outbound.segments.length - 1;

        const timeline = calculateFlightTimeline({
          departureIso: firstSegment.departure.at,
          durationMinutes: this.parseDurationMinutes(outbound.duration),
          originIata: query.origin,
          destinationIata: query.destination,
        });

        const fingerprint = `${query.origin}_${query.destination}_${timeline.departureDateOnly}_${airlineCode}_${flightNumber.replace(/\s+/g, "")}_${timeline.departureTimeLocal.replace(/:/g, "")}`;

        const segments: FlightSegment[] = outbound.segments.map((s) => ({
          airline: s.carrierCode,
          airlineCode: s.carrierCode,
          flightNumber: `${s.carrierCode} ${s.number}`,
          origin: s.departure.iataCode,
          originName: getAirportDetails(s.departure.iataCode)?.name,
          destination: s.arrival.iataCode,
          destinationName: getAirportDetails(s.arrival.iataCode)?.name,
          departureDate: s.departure.at.split("T")[0],
          departureTime: s.departure.at.split("T")[1]?.slice(0, 5) || "00:00",
          arrivalDate: s.arrival.at.split("T")[0],
          arrivalTime: s.arrival.at.split("T")[1]?.slice(0, 5) || "00:00",
          durationMinutes: this.parseDurationMinutes(s.duration),
          durationFormatted: s.duration.replace("PT", "").toLowerCase(),
        }));

        offers.push({
          id: `amadeus_${raw.id || idx}_${fingerprint}`,
          itineraryFingerprint: fingerprint,
          airline: this.getAirlineName(airlineCode),
          airlineCode,
          flightNumber,
          originAirport: query.origin,
          originCity: originInfo?.city || query.origin,
          destinationAirport: query.destination,
          destinationCity: destInfo?.city || query.destination,
          departureDate: timeline.departureDateOnly,
          departureTime: timeline.departureTimeLocal,
          arrivalDate: timeline.arrivalDateOnly,
          arrivalTime: timeline.arrivalTimeLocal,
          durationMinutes: timeline.durationMinutes,
          durationFormatted: timeline.durationFormatted,
          stops,
          stopsLabel: stops === 0 ? "Non-stop" : `${stops} Stop`,
          segments,
          price: totalPrice,
          pricePerAdult: Math.round(totalPrice / (query.adults || 1)),
          formattedPrice: formatCurrency(totalPrice, query.currency || "INR"),
          currency: query.currency || "INR",
          priceStatus: "LIVE_SEARCH_PRICE",
          priceStatusLabel: "Live GDS Fare",
          cabinClass: query.cabinClass || "economy",
          baggageAllowance: "15 kg Check-in, 7 kg Cabin",
          seller: "Amadeus GDS",
          bookingUrl: null,
          comparisonSites: [],
          isOvernight: timeline.isOvernight,
          dayDifference: timeline.dayDifference,
          score: 90,
        });
      } catch {}
    });

    return offers;
  }

  private static parseDurationMinutes(isoDuration?: string): number {
    if (!isoDuration) return 120;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 120;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    return hours * 60 + minutes;
  }

  private static getAirlineName(code: string): string {
    const AIRLINES: Record<string, string> = {
      "6E": "IndiGo",
      AI: "Air India",
      IX: "Air India Express",
      QP: "Akasa Air",
      SG: "SpiceJet",
      UK: "Vistara",
      BA: "British Airways",
      EK: "Emirates",
      QR: "Qatar Airways",
      LH: "Lufthansa",
      SQ: "Singapore Airlines",
      FZ: "Flydubai",
      EY: "Etihad Airways",
    };
    return AIRLINES[code.toUpperCase()] || code.toUpperCase();
  }
}
