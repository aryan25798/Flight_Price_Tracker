import { NextRequest, NextResponse } from "next/server";
import { fetchLiveFlightPrices } from "@/lib/flights/pricing-service";
import type { PriceReliabilityStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { origin, destination, departureDate, airlineCode, flightNumber, expectedPrice, currency = "INR" } = body;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "origin, destination, and departureDate are required to revalidate an offer." },
        { status: 400 }
      );
    }

    // Call live quote
    const quote = await fetchLiveFlightPrices({
      origin,
      destination,
      departureDate,
      currency,
    });

    if (!quote || !quote.found || !quote.options || quote.options.length === 0) {
      return NextResponse.json({
        revalidated: false,
        status: "UNAVAILABLE" as PriceReliabilityStatus,
        message: "This specific flight offer is no longer available in the active cache. Please verify on comparison partners.",
        comparisonSites: quote?.comparisonSites || [],
      });
    }

    // Match exact flight or top option
    const matched = quote.options.find(
      (o) => (flightNumber && o.flightNumber === flightNumber) || (airlineCode && o.airlineCode === airlineCode)
    ) || quote.options[0];

    const priceChanged = expectedPrice ? matched.price !== Number(expectedPrice) : false;

    return NextResponse.json({
      revalidated: true,
      status: matched.priceStatus || "REVALIDATED_PRICE",
      currentPrice: matched.price,
      currency: matched.currency,
      priceChanged,
      difference: expectedPrice ? matched.price - Number(expectedPrice) : 0,
      bookingUrl: matched.bookingUrl,
      lastVerifiedAt: new Date().toISOString(),
      comparisonSites: quote.comparisonSites,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to revalidate flight price" },
      { status: 500 }
    );
  }
}
