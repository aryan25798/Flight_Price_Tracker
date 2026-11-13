export interface FlightSearchQuery {
  routeKey: string;
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null;
  tripType: "one_way" | "round_trip";
  adults: number;
  children: number;
  infants: number;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
  currency: string;
}

export interface NormalizedFlightOffer {
  price: number;
  currency: string;
  airline: string | null;
  flightNumber: string | null;
  departureAt: string;
  returnAt: string | null;
  transfers: number | null;
  bookingUrl: string | null;
  provider: string;
}

export interface ProviderCapabilities {
  supportsPassengerFilter: boolean;
  supportsCabinFilter: boolean;
  isCachedData: boolean;
}

export class FlightProviderError extends Error {
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(message: string, retryable: boolean, statusCode?: number) {
    super(message);
    this.name = "FlightProviderError";
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export interface FlightProvider {
  getProviderName(): string;
  getCapabilities(): ProviderCapabilities;
  searchFlights(query: FlightSearchQuery): Promise<NormalizedFlightOffer | null>;
  validateResponse(raw: unknown): unknown;
  normalizeResponse(raw: unknown, query: FlightSearchQuery): NormalizedFlightOffer | null;
  getBookingUrl(rawLink: string | undefined | null, query: FlightSearchQuery): string | null;
}
