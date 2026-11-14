import {
  type FlightOption,
  type FlightPriceQuote,
  type PriceReliabilityStatus,
} from "@/lib/flights/pricing-service";

export type { FlightOption, FlightPriceQuote, PriceReliabilityStatus };

export async function checkCurrentPriceAction(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType: "one_way" | "round_trip";
  currency: string;
  directOnly?: boolean;
}): Promise<FlightPriceQuote> {
  try {
    const res = await fetch("/api/check-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { found: false, message: data.message || "Failed to check current price" };
    }
    return data as FlightPriceQuote;
  } catch {
    return { found: false, message: "Network error checking price" };
  }
}
