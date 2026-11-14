import { generateMultiSiteComparisonLinks, type MultiSiteDealLink } from "@/lib/flight-urls";

export interface FlightOption {
  price: number;
  currency: string;
  airline: string;
  seller: string;
  departureAt: string;
  transfers: number;
  durationMinutes: number;
  flightNumber: string;
  bookingUrl: string;
  isDirect: boolean;
}

export interface FlightPriceQuote {
  found: boolean;
  bestPrice?: number;
  currency?: string;
  isFallback?: boolean;
  options?: FlightOption[];
  comparisonSites?: MultiSiteDealLink[];
  message?: string;
}

/**
 * Server-Side Pure Flight Pricing Service
 *
 * Can be safely invoked by API routes, server actions, background crons,
 * and AI copilot tools without requiring client-side relative HTTP fetch.
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
      comparisonSites,
      message: "Flight price check service token unconfigured.",
    };
  }

  const buildUrl = (useDate: boolean) => {
    const u = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
    u.searchParams.set("origin", origin.toUpperCase());
    u.searchParams.set("destination", destination.toUpperCase());
    if (useDate) {
      u.searchParams.set("departure_at", departureDate);
      if (tripType === "round_trip" && returnDate) {
        u.searchParams.set("return_at", returnDate);
      }
    }
    if (directOnly) {
      u.searchParams.set("direct", "true");
    }
    u.searchParams.set("one_way", tripType === "one_way" ? "true" : "false");
    u.searchParams.set("currency", currency.toLowerCase());
    u.searchParams.set("sorting", "price");
    u.searchParams.set("limit", "15");
    return u.toString();
  };

  try {
    let res = await fetch(buildUrl(true), {
      headers: { "X-Access-Token": token, Accept: "application/json" },
      cache: "no-store",
    });

    let data = await res.json().catch(() => ({}));
    let isFallback = false;

    // If no exact match for this specific date, fallback to observed route options
    if (!data.success || !data.data || data.data.length === 0) {
      res = await fetch(buildUrl(false), {
        headers: { "X-Access-Token": token, Accept: "application/json" },
        cache: "no-store",
      });
      data = await res.json().catch(() => ({}));
      isFallback = true;
    }

    if (!data.success || !data.data || data.data.length === 0) {
      return {
        found: false,
        comparisonSites,
        message: directOnly
          ? "No direct flights found in cache for this date. Compare live across Google Flights, Skyscanner, or MakeMyTrip."
          : "No current cached flights found for this route yet. Compare live across Google Flights, Skyscanner, or MakeMyTrip.",
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

    const filtered = directOnly
      ? rawOffers.filter((o) => (o.transfers ?? 0) === 0)
      : rawOffers;

    if (filtered.length === 0) {
      return {
        found: false,
        comparisonSites,
        message: "No direct flights available in cache. Switch to any flights or compare across major booking portals.",
      };
    }

    const options: FlightOption[] = filtered.slice(0, 5).map((o) => {
      const link = o.link
        ? `https://www.aviasales.com${o.link.startsWith("/") ? "" : "/"}${o.link}?marker=${marker}`
        : `https://www.aviasales.com?marker=${marker}`;

      return {
        price: o.price,
        currency: (data.currency || currency || "INR").toUpperCase(),
        airline: o.airline || "Available Airline",
        seller: o.gate || "Airline Direct",
        departureAt: o.departure_at,
        transfers: o.transfers ?? 0,
        durationMinutes: o.duration || 0,
        flightNumber: String(o.flight_number || ""),
        bookingUrl: link,
        isDirect: (o.transfers ?? 0) === 0,
      };
    });

    return {
      found: true,
      isFallback,
      currency: (data.currency || currency || "INR").toUpperCase(),
      bestPrice: options[0].price,
      options,
      comparisonSites,
      message: isFallback
        ? `Exact date ${departureDate} had no cached fares. Lowest recent flight on this route starts at ${(data.currency || currency || "INR").toUpperCase()} ${options[0].price.toLocaleString()}.`
        : undefined,
    };
  } catch (err) {
    console.error("fetchLiveFlightPrices error:", err);
    return {
      found: false,
      comparisonSites,
      message: err instanceof Error ? err.message : "Failed to fetch live flight prices",
    };
  }
}
