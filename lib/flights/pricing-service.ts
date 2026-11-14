import { generateMultiSiteComparisonLinks, type MultiSiteDealLink } from "@/lib/flight-urls";
import {
  calculateFlightTimeline,
  validateFlightMatchesRequestedDate,
} from "@/lib/dates/flight-datetime";

export type PriceReliabilityStatus =
  | "LIVE_SEARCH_PRICE"
  | "REVALIDATED_PRICE"
  | "INDICATIVE_PRICE"
  | "CACHED_PRICE"
  | "EXPIRED_PRICE"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface FlightOption {
  id: string;
  price: number;
  currency: string;
  airline: string;
  airlineCode?: string;
  seller: string;
  departureAt: string;
  departureDateOnly: string;
  departureTimeLocal: string;
  arrivalDateOnly: string;
  arrivalTimeLocal: string;
  originTimeZone: string;
  destinationTimeZone: string;
  durationMinutes: number;
  durationFormatted: string;
  isOvernight: boolean;
  dayDifference: number;
  transfers: number;
  flightNumber: string;
  bookingUrl: string;
  isDirect: boolean;
  priceStatus: PriceReliabilityStatus;
  priceRetrievedAt: string;
}

export interface FlightPriceQuote {
  found: boolean;
  bestPrice?: number;
  currency?: string;
  priceStatus?: PriceReliabilityStatus;
  options?: FlightOption[];
  comparisonSites?: MultiSiteDealLink[];
  message?: string;
  requestedDepartureDate?: string;
  requestedReturnDate?: string | null;
}

/**
 * Server-Side Pure Flight Pricing Service (Phase 1 Date-Grounded Engine)
 *
 * Can be safely invoked by API routes, server actions, background crons,
 * and AI copilot tools without client-side relative HTTP fetch.
 *
 * CRITICAL RULE: NEVER silently substitutes an arbitrary date when the exact
 * requested departure date has no cached results.
 */
export async function fetchLiveFlightPrices(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType?: "one_way" | "round_trip";
  currency?: string;
  directOnly?: boolean;
}): Promise<FlightPriceQuote> {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    tripType = "one_way",
    currency = "INR",
    directOnly = false,
  } = params;

  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  const marker = process.env.TRAVELPAYOUTS_MARKER || "804763";

  const comparisonSites = generateMultiSiteComparisonLinks({
    origin,
    destination,
    departureDate,
    returnDate,
    tripType,
    marker,
  });

  if (!token) {
    return {
      found: false,
      priceStatus: "UNAVAILABLE",
      requestedDepartureDate: departureDate,
      requestedReturnDate: returnDate,
      comparisonSites,
      message: "Flight price check service token unconfigured.",
    };
  }

  const buildUrl = () => {
    const u = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
    u.searchParams.set("origin", origin.toUpperCase());
    u.searchParams.set("destination", destination.toUpperCase());
    u.searchParams.set("departure_at", departureDate);
    if (tripType === "round_trip" && returnDate) {
      u.searchParams.set("return_at", returnDate);
    }
    if (directOnly) {
      u.searchParams.set("direct", "true");
    }
    u.searchParams.set("one_way", tripType === "one_way" ? "true" : "false");
    u.searchParams.set("currency", currency.toLowerCase());
    u.searchParams.set("sorting", "price");
    u.searchParams.set("limit", "20");
    return u.toString();
  };

  try {
    const res = await fetch(buildUrl(), {
      headers: { "X-Access-Token": token, Accept: "application/json" },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!data.success || !data.data || data.data.length === 0) {
      return {
        found: false,
        priceStatus: "UNAVAILABLE",
        requestedDepartureDate: departureDate,
        requestedReturnDate: returnDate,
        comparisonSites,
        message: directOnly
          ? `No direct cached flights found for ${origin} → ${destination} on ${departureDate}. Compare live across Google Flights, Skyscanner, or MakeMyTrip.`
          : `No cached flights found for ${origin} → ${destination} on ${departureDate}. Compare live across Google Flights, Skyscanner, or MakeMyTrip.`,
      };
    }

    const rawOffers = (data.data as Array<{
      price: number;
      airline?: string;
      gate?: string;
      departure_at: string;
      transfers?: number;
      duration?: number;
      flight_number?: string | number;
      link?: string;
    }>) || [];

    // STRICT DATE GROUNDING: verify every offer matches requested departure date
    const dateMatchedOffers = rawOffers.filter((o) =>
      validateFlightMatchesRequestedDate(o.departure_at, departureDate, origin),
    );

    if (dateMatchedOffers.length === 0) {
      return {
        found: false,
        priceStatus: "UNAVAILABLE",
        requestedDepartureDate: departureDate,
        requestedReturnDate: returnDate,
        comparisonSites,
        message: `No exact cached fares found for ${origin} → ${destination} on ${departureDate}. Check real-time booking portals below.`,
      };
    }

    const filtered = directOnly
      ? dateMatchedOffers.filter((o) => (o.transfers ?? 0) === 0)
      : dateMatchedOffers;

    if (filtered.length === 0) {
      return {
        found: false,
        priceStatus: "UNAVAILABLE",
        requestedDepartureDate: departureDate,
        requestedReturnDate: returnDate,
        comparisonSites,
        message: "No direct flights available in cache for this date. Switch to all flights or compare across booking portals.",
      };
    }

    const retrievedAt = new Date().toISOString();
    const options: FlightOption[] = filtered.slice(0, 10).map((o, idx) => {
      const link = o.link
        ? `https://www.aviasales.com${o.link.startsWith("/") ? "" : "/"}${o.link}?marker=${marker}`
        : `https://www.aviasales.com?marker=${marker}`;

      const timeline = calculateFlightTimeline({
        departureIso: o.departure_at,
        durationMinutes: o.duration,
        originIata: origin,
        destinationIata: destination,
      });

      const flightNumber = String(o.flight_number || "");
      const airlineCode = o.airline || "";
      const optionId = `opt_${origin}_${destination}_${departureDate}_${airlineCode}_${flightNumber}_${idx}`;

      return {
        id: optionId,
        price: o.price,
        currency: (data.currency || currency || "INR").toUpperCase(),
        airline: o.airline || "Available Airline",
        airlineCode,
        seller: o.gate || "Airline Direct",
        departureAt: o.departure_at,
        departureDateOnly: timeline.departureDateOnly,
        departureTimeLocal: timeline.departureTimeLocal,
        arrivalDateOnly: timeline.arrivalDateOnly,
        arrivalTimeLocal: timeline.arrivalTimeLocal,
        originTimeZone: timeline.originTimeZone,
        destinationTimeZone: timeline.destinationTimeZone,
        durationMinutes: timeline.durationMinutes,
        durationFormatted: timeline.durationFormatted,
        isOvernight: timeline.isOvernight,
        dayDifference: timeline.dayDifference,
        transfers: o.transfers ?? 0,
        flightNumber,
        bookingUrl: link,
        isDirect: (o.transfers ?? 0) === 0,
        priceStatus: "CACHED_PRICE",
        priceRetrievedAt: retrievedAt,
      };
    });

    return {
      found: true,
      priceStatus: "CACHED_PRICE",
      currency: (data.currency || currency || "INR").toUpperCase(),
      bestPrice: options[0].price,
      options,
      comparisonSites,
      requestedDepartureDate: departureDate,
      requestedReturnDate: returnDate,
    };
  } catch (err) {
    console.error("fetchLiveFlightPrices error:", err);
    return {
      found: false,
      priceStatus: "UNAVAILABLE",
      requestedDepartureDate: departureDate,
      requestedReturnDate: returnDate,
      comparisonSites,
      message: err instanceof Error ? err.message : "Failed to fetch live flight prices",
    };
  }
}
