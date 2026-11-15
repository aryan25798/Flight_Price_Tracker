import { z } from "https://esm.sh/zod@3.24.2";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { getFlightProvider } from "../_shared/flight-provider/registry.ts";
import { type FlightSearchQuery } from "../_shared/flight-provider/types.ts";
import { sha256Hex } from "../_shared/telegram.ts";

const QuoteQuerySchema = z.object({
  origin: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  destination: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  tripType: z.enum(["one_way", "round_trip"]),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  infants: z.number().int().min(0).max(9).default(0),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).default("INR"),
});

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const parsed = QuoteQuerySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid parameters", 400);
  }

  const q = parsed.data;
  if (q.origin === q.destination) {
    return errorResponse("Origin and destination must differ", 400);
  }

  try {
    const routeKey = await sha256Hex(
      JSON.stringify({
        origin: q.origin,
        destination: q.destination,
        departure_date: q.departureDate,
        return_date: q.tripType === "round_trip" && q.returnDate ? q.returnDate : null,
        trip_type: q.tripType,
        currency: q.currency,
        provider: "travelpayouts",
      }),
    );

    const searchQuery: FlightSearchQuery = {
      routeKey,
      origin: q.origin,
      destination: q.destination,
      departureDate: q.departureDate,
      returnDate: q.tripType === "round_trip" && q.returnDate ? q.returnDate : null,
      tripType: q.tripType,
      adults: q.adults,
      children: q.children,
      infants: q.infants,
      cabinClass: q.cabinClass,
      currency: q.currency,
    };

    let provider = getFlightProvider("google_flights");
    let offer = await provider.searchFlights(searchQuery);

    if (!offer) {
      provider = getFlightProvider("travelpayouts");
      offer = await provider.searchFlights(searchQuery);
    }

    if (!offer) {
      return jsonResponse({
        found: false,
        message: "No cached fare found for this specific date yet. You can still set your target price to start monitoring!",
      });
    }

    return jsonResponse({
      found: true,
      price: offer.price,
      currency: offer.currency,
      airline: offer.airline,
      departureAt: offer.departureAt,
      returnAt: offer.returnAt,
      bookingUrl: offer.bookingUrl,
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to fetch live flight price",
      500,
    );
  }
});
