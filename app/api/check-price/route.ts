import { NextResponse } from "next/server";
import { checkPriceRateLimiter } from "@/lib/rate-limiter";
import {
  fetchLiveFlightPrices,
  type FlightOption,
  type FlightPriceQuote,
} from "@/lib/flights/pricing-service";

export type { FlightOption, FlightPriceQuote };

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

    const result = await fetchLiveFlightPrices({
      origin,
      destination,
      departureDate,
      returnDate,
      tripType,
      currency,
      directOnly,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("check-price error:", err);
    return NextResponse.json(
      { found: false, message: err instanceof Error ? err.message : "Failed to fetch flight options" },
      { status: 500 },
    );
  }
}
