import { TravelpayoutsProvider } from "./travelpayouts.ts";
import { GoogleFlightsProvider } from "./google-flights.ts";
import { type FlightProvider } from "./types.ts";

export function getFlightProvider(providerName: string): FlightProvider {
  switch (providerName?.toLowerCase()) {
    case "travelpayouts":
    case "aviasales":
      return new TravelpayoutsProvider();
    case "google_flights":
    case "serpapi":
    case "oag":
    case "amadeus":
    default:
      // Default to Google Flights (SerpApi) provider
      return new GoogleFlightsProvider();
  }
}
