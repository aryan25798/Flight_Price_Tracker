import type { FlightSearchQuery, NormalizedFlightOffer, FlightSegment } from "../search-service";
import { formatCurrency } from "@/lib/utils";
import { calculateFlightTimeline, validateFlightMatchesRequestedDate } from "@/lib/dates/flight-datetime";
import { getAirportDetails } from "../airport-resolver";

/**
 * Helper to parse SerpApi time strings which can be:
 * - "2026-11-27 06:15" (standard SerpApi Google Flights format)
 * - "06:15" (time-only format)
 * - "2026-11-27T06:15:00" (ISO format)
 */
function parseSerpApiDateTime(rawTime: string | undefined, fallbackDate: string): { date: string; time: string } {
  if (!rawTime || typeof rawTime !== "string") {
    return { date: fallbackDate, time: "00:00" };
  }

  const trimmed = rawTime.trim();

  // Format: "YYYY-MM-DD HH:MM"
  if (trimmed.includes(" ")) {
    const [d, t] = trimmed.split(" ");
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallbackDate,
      time: t ? t.slice(0, 5) : "00:00",
    };
  }

  // Format: "YYYY-MM-DDTHH:MM:SS"
  if (trimmed.includes("T")) {
    const [d, t] = trimmed.split("T");
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallbackDate,
      time: t ? t.slice(0, 5) : "00:00",
    };
  }

  // Format: "HH:MM"
  if (/^\d{1,2}:\d{2}/.test(trimmed)) {
    const parts = trimmed.split(":");
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].slice(0, 2);
    return { date: fallbackDate, time: `${hh}:${mm}` };
  }

  return { date: fallbackDate, time: "00:00" };
}

/**
 * SerpApi Google Flights Live Search Adapter
 *
 * Scrapes and aggregates live real-time flight inventory from Google Flights via SerpApi.
 * Returns all 15–30 daily departures with exact flight numbers, airlines, durations,
 * stops, and real-time live prices.
 */
export class SerpApiGoogleFlightsAdapter {
  public static isConfigured(): boolean {
    const key = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
    return Boolean(key && key.trim());
  }

  public static async searchFlights(query: FlightSearchQuery): Promise<NormalizedFlightOffer[]> {
    const apiKey = (process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY || "").trim();
    if (!apiKey) return [];

    const u = new URL("https://serpapi.com/search");
    u.searchParams.set("engine", "google_flights");
    u.searchParams.set("departure_id", query.origin.toUpperCase());
    u.searchParams.set("arrival_id", query.destination.toUpperCase());
    u.searchParams.set("outbound_date", query.departureDate);
    if (query.tripType === "round_trip" && query.returnDate) {
      u.searchParams.set("return_date", query.returnDate);
      u.searchParams.set("type", "1"); // 1 = Round trip
    } else {
      u.searchParams.set("type", "2"); // 2 = One-way
    }
    u.searchParams.set("adults", String(query.adults || 1));
    u.searchParams.set("currency", (query.currency || "INR").toUpperCase());
    u.searchParams.set("hl", "en");
    u.searchParams.set("api_key", apiKey);
    if (query.directOnly) {
      u.searchParams.set("stops", "1"); // 1 = Nonstop only
    }

    try {
      const res = await fetch(u.toString(), { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[SerpApi] Google Flights responded with HTTP ${res.status}: ${res.statusText}`);
        return [];
      }
      const data = await res.json();

      const rawFlightGroups = [
        ...((data.best_flights as Array<Record<string, unknown>>) || []),
        ...((data.other_flights as Array<Record<string, unknown>>) || []),
      ];

      return this.normalizeGoogleFlights(rawFlightGroups, query);
    } catch (err) {
      console.error("[SerpApi] Google Flights adapter error:", err);
      return [];
    }
  }

  public static normalizeGoogleFlights(
    rawGroups: Array<Record<string, unknown>>,
    query: FlightSearchQuery
  ): NormalizedFlightOffer[] {
    const offers: NormalizedFlightOffer[] = [];
    const originInfo = getAirportDetails(query.origin);
    const destInfo = getAirportDetails(query.destination);

    rawGroups.forEach((group, idx) => {
      try {
        const flights = (group.flights as Array<{
          departure_airport?: { id?: string; name?: string; time?: string };
          arrival_airport?: { id?: string; name?: string; time?: string };
          duration?: number;
          airline?: string;
          airline_logo?: string;
          flight_number?: string;
          airplane?: string;
          travel_class?: string;
          extensions?: string[];
        }>) || [];

        if (flights.length === 0) return;

        const firstLeg = flights[0];
        const lastLeg = flights[flights.length - 1];

        const rawPrice = typeof group.price === "number" ? group.price : Number(group.price || 0);
        if (isNaN(rawPrice) || rawPrice <= 0) return;

        const totalPassengers = query.adults || 1;
        const totalPrice = rawPrice * totalPassengers;
        const totalDuration =
          typeof group.total_duration === "number"
            ? group.total_duration
            : firstLeg.duration || 120;
        const stops = flights.length - 1;

        // Extract departure & arrival date and time
        const depParsed = parseSerpApiDateTime(firstLeg.departure_airport?.time, query.departureDate);
        const arrParsed = parseSerpApiDateTime(lastLeg.arrival_airport?.time, query.departureDate);

        // Strict Date Grounding: Verify flight departs on user's selected calendar date
        if (!validateFlightMatchesRequestedDate(depParsed.date, query.departureDate)) {
          return;
        }

        const airlineName = firstLeg.airline || "Airline";
        const flightNumber = firstLeg.flight_number || `${airlineName} ${idx + 101}`;
        const airlineCode = this.deriveAirlineCode(airlineName, flightNumber);

        // Calculate timeline with timezone safety
        const timeline = calculateFlightTimeline({
          departureIso: `${depParsed.date}T${depParsed.time}:00`,
          durationMinutes: totalDuration,
          originIata: query.origin,
          destinationIata: query.destination,
        });

        const cleanFlightNo = flightNumber.replace(/\s+/g, "");
        const fingerprint = `${query.origin}_${query.destination}_${depParsed.date}_${airlineCode}_${cleanFlightNo}_${depParsed.time.replace(/:/g, "")}`;

        const segments: FlightSegment[] = flights.map((leg) => {
          const segDep = parseSerpApiDateTime(leg.departure_airport?.time, query.departureDate);
          const segArr = parseSerpApiDateTime(leg.arrival_airport?.time, segDep.date);
          const legDuration = leg.duration || Math.round(totalDuration / flights.length);

          return {
            airline: leg.airline || airlineName,
            airlineCode: this.deriveAirlineCode(leg.airline, leg.flight_number),
            flightNumber: leg.flight_number || flightNumber,
            origin: leg.departure_airport?.id || query.origin,
            originName: leg.departure_airport?.name,
            destination: leg.arrival_airport?.id || query.destination,
            destinationName: leg.arrival_airport?.name,
            departureDate: segDep.date,
            departureTime: segDep.time,
            arrivalDate: segArr.date,
            arrivalTime: segArr.time,
            durationMinutes: legDuration,
            durationFormatted: `${Math.floor(legDuration / 60)}h ${legDuration % 60}m`,
          };
        });

        // Baggage or extension details
        const baggageInfo =
          firstLeg.extensions?.find((e) => /bag|cabin|luggage/i.test(e)) || "15 kg Check-in, 7 kg Cabin";

        offers.push({
          id: `serp_${fingerprint}_${idx}`,
          itineraryFingerprint: fingerprint,
          airline: airlineName,
          airlineCode,
          flightNumber,
          originAirport: query.origin,
          originCity: originInfo?.city || query.origin,
          destinationAirport: query.destination,
          destinationCity: destInfo?.city || query.destination,
          departureDate: depParsed.date,
          departureTime: depParsed.time,
          arrivalDate: arrParsed.date || timeline.arrivalDateOnly,
          arrivalTime: arrParsed.time,
          durationMinutes: totalDuration,
          durationFormatted: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
          stops,
          stopsLabel: stops === 0 ? "Non-stop" : `${stops} Stop`,
          segments,
          price: totalPrice,
          pricePerAdult: rawPrice,
          formattedPrice: formatCurrency(totalPrice, query.currency || "INR"),
          currency: query.currency || "INR",
          priceStatus: "LIVE_SEARCH_PRICE",
          priceStatusLabel: "Live Google Flights Fare",
          cabinClass: query.cabinClass || "economy",
          baggageAllowance: baggageInfo,
          seller: "Google Flights Live",
          bookingUrl: `https://www.google.com/travel/flights?q=Flights%20to%20${query.destination}%20from%20${query.origin}%20on%20${query.departureDate}`,
          comparisonSites: [],
          isOvernight: timeline.isOvernight || arrParsed.date !== depParsed.date,
          dayDifference: timeline.dayDifference,
          score: 95 - idx * 2,
        });
      } catch {
        // Skip malformed record
      }
    });

    return offers;
  }

  private static deriveAirlineCode(airlineName?: string, flightNumber?: string): string {
    if (flightNumber) {
      const match = flightNumber.trim().match(/^([A-Z0-9]{2})\s*\d+/i);
      if (match) return match[1].toUpperCase();
    }
    const lower = (airlineName || "").toLowerCase();
    if (lower.includes("indigo")) return "6E";
    if (lower.includes("air india express")) return "IX";
    if (lower.includes("air india")) return "AI";
    if (lower.includes("akasa")) return "QP";
    if (lower.includes("spicejet")) return "SG";
    if (lower.includes("vistara")) return "UK";
    if (lower.includes("emirates")) return "EK";
    if (lower.includes("qatar")) return "QR";
    if (lower.includes("lufthansa")) return "LH";
    if (lower.includes("british")) return "BA";
    if (lower.includes("singapore")) return "SQ";
    return "FL";
  }
}
