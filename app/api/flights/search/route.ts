import { NextRequest, NextResponse } from "next/server";
import { FlightSearchService, type FlightSearchQuery } from "@/lib/flights/search-service";
import type { CabinClass, Currency } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const departureDate = searchParams.get("departureDate");

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "origin, destination, and departureDate are required parameters." },
        { status: 400 }
      );
    }

    const returnDate = searchParams.get("returnDate");
    const tripType = searchParams.get("tripType") === "round_trip" ? "round_trip" : "one_way";
    const adults = parseInt(searchParams.get("adults") || "1", 10);
    const children = parseInt(searchParams.get("children") || "0", 10);
    const infants = parseInt(searchParams.get("infants") || "0", 10);
    const cabinClass = (searchParams.get("cabinClass") || "economy") as CabinClass;
    const currency = (searchParams.get("currency") || "INR") as Currency;
    const directOnly = searchParams.get("directOnly") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const sortBy = searchParams.get("sortBy") as FlightSearchQuery["sortBy"] || "cheapest";

    const rawStops = searchParams.get("stops");
    const rawAirlines = searchParams.get("airlines");
    const rawMinPrice = searchParams.get("minPrice");
    const rawMaxPrice = searchParams.get("maxPrice");
    const rawDepTimeSlot = searchParams.get("depTimeSlot");

    const query: FlightSearchQuery = {
      origin,
      destination,
      departureDate,
      returnDate,
      tripType,
      adults,
      children,
      infants,
      cabinClass,
      currency,
      directOnly,
      page,
      pageSize,
      sortBy,
      filters: {
        stops: rawStops ? rawStops.split(",").map((s) => parseInt(s.trim(), 10)) : undefined,
        airlines: rawAirlines ? rawAirlines.split(",").map((a) => a.trim().toUpperCase()) : undefined,
        minPrice: rawMinPrice ? parseFloat(rawMinPrice) : undefined,
        maxPrice: rawMaxPrice ? parseFloat(rawMaxPrice) : undefined,
        depTimeSlot: rawDepTimeSlot
          ? (rawDepTimeSlot.split(",").map((s) => s.trim()) as ("morning" | "afternoon" | "evening" | "night")[])
          : undefined,
      },
    };

    const results = await FlightSearchService.search(query);
    return NextResponse.json(results);
  } catch (err) {
    const error = err as Error;
    console.error("Flight search API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute flight discovery search" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as FlightSearchQuery;
    if (!body.origin || !body.destination || !body.departureDate) {
      return NextResponse.json(
        { error: "origin, destination, and departureDate are required in request body." },
        { status: 400 }
      );
    }

    const results = await FlightSearchService.search(body);
    return NextResponse.json(results);
  } catch (err) {
    const error = err as Error;
    console.error("Flight search API POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute flight discovery search" },
      { status: 500 }
    );
  }
}
