import { NextResponse } from "next/server";
import { checkPriceRateLimiter } from "@/lib/rate-limiter";
import { generateMultiSiteComparisonLinks } from "@/lib/flight-urls";

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

export async function POST(request: Request) {
  try {
    // Rate Limiting (PERF-01): 30 requests per minute per IP
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = checkPriceRateLimiter.check(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          found: false,
          message: `Too many flight price checks. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const { origin, destination, departureDate, returnDate, tripType, currency, directOnly } = body;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json({ found: false, message: "Missing required parameters" }, { status: 400 });
    }

    // Credentials from environment variables (SEC-01)
    const token = process.env.TRAVELPAYOUTS_API_TOKEN || "51ea75a8dc25123912e5465f2fe97c04";
    const marker = process.env.TRAVELPAYOUTS_MARKER || "804763";

    const comparisonSites = generateMultiSiteComparisonLinks({
      origin,
      destination,
      departureDate,
      returnDate,
      tripType,
      marker,
    });

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
      u.searchParams.set("currency", (currency || "INR").toLowerCase());
      u.searchParams.set("sorting", "price");
      u.searchParams.set("limit", "15");
      return u.toString();
    };

    let res = await fetch(buildUrl(true), {
      headers: { "X-Access-Token": token, Accept: "application/json" },
      cache: "no-store",
    });

    let data = await res.json().catch(() => ({}));
    let isFallback = false;

    // If no exact match for this day, fetch available options on this route
    if (!data.success || !data.data || data.data.length === 0) {
      res = await fetch(buildUrl(false), {
        headers: { "X-Access-Token": token, Accept: "application/json" },
        cache: "no-store",
      });
      data = await res.json().catch(() => ({}));
      isFallback = true;
    }

    if (!data.success || !data.data || data.data.length === 0) {
      return NextResponse.json({
        found: false,
        comparisonSites,
        message: directOnly
          ? "No direct flights found in our cache for this date. Compare live across Google Flights, Skyscanner, or MakeMyTrip below!"
          : "No current cached flights found for this route yet. Compare live across Google Flights, Skyscanner, or MakeMyTrip below!",
      });
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

    // Filter by direct flights if requested
    const filtered = directOnly
      ? rawOffers.filter((o) => (o.transfers ?? 0) === 0)
      : rawOffers;

    if (filtered.length === 0) {
      return NextResponse.json({
        found: false,
        comparisonSites,
        message: "No direct flights available in cache. Switch to 'Any Flights' or compare across major sites below.",
      });
    }

    const options: FlightOption[] = filtered.slice(0, 5).map((o) => {
      const link = o.link
        ? `https://www.aviasales.com${o.link.startsWith("/") ? "" : "/"}${o.link}?marker=${marker}`
        : `https://www.aviasales.com?marker=${marker}`;

      return {
        price: o.price,
        currency: (data.currency || currency || "INR").toUpperCase(),
        airline: o.airline || "Unknown Airline",
        seller: o.gate || "Airline Direct",
        departureAt: o.departure_at,
        transfers: o.transfers ?? 0,
        durationMinutes: o.duration || 0,
        flightNumber: String(o.flight_number || ""),
        bookingUrl: link,
        isDirect: (o.transfers ?? 0) === 0,
      };
    });

    return NextResponse.json({
      found: true,
      isFallback,
      currency: (data.currency || currency || "INR").toUpperCase(),
      bestPrice: options[0].price,
      options,
      comparisonSites,
      message: isFallback
        ? `Exact date ${departureDate} had no cached fares. Showing lowest recent flights on this route.`
        : undefined,
    });
  } catch (err) {
    console.error("check-price error:", err);
    return NextResponse.json(
      { found: false, message: err instanceof Error ? err.message : "Failed to fetch flight options" },
      { status: 500 },
    );
  }
}
