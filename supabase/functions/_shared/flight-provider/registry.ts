import { TravelpayoutsProvider } from "./travelpayouts.ts";
import { FlightProviderError, type FlightProvider } from "./types.ts";

export function getFlightProvider(providerName: string): FlightProvider {
  switch (providerName.toLowerCase()) {
    case "travelpayouts":
      return new TravelpayoutsProvider();
    default:
      throw new FlightProviderError(`Unsupported flight provider: ${providerName}`, false);
  }
}
