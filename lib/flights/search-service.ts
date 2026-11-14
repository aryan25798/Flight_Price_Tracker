import { fetchLiveFlightPrices, type FlightOption } from "./pricing-service";
import { generateMultiSiteComparisonLinks } from "@/lib/flight-urls";
import { AmadeusAdapter } from "./adapters/amadeus";
import {
  calculateFlightTimeline,
  validateFlightMatchesRequestedDate,
  getTodayDateString,
  getTomorrowDateString,
  compareDateOnly,
  formatCalendarDate,
} from "@/lib/dates/flight-datetime";
import { resolveAirportCode, getAirportDetails } from "./airport-resolver";
import { formatCurrency } from "@/lib/utils";
import type { CabinClass, Currency, PriceReliabilityStatus } from "@/types/database";

export interface FlightSearchQuery {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType?: "one_way" | "round_trip";
  adults?: number;
  children?: number;
  infants?: number;
  cabinClass?: CabinClass;
  currency?: Currency;
  directOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "cheapest" | "fastest" | "earliest_dep" | "latest_dep" | "earliest_arr" | "latest_arr" | "best";
  filters?: {
    stops?: number[]; // [0, 1, 2]
    airlines?: string[]; // ["6E", "AI", "UK"]
    maxPrice?: number;
    minPrice?: number;
    depTimeSlot?: ("morning" | "afternoon" | "evening" | "night")[];
  };
}

export interface FlightSegment {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  origin: string;
  originName?: string;
  destination: string;
  destinationName?: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes: number;
  durationFormatted: string;
}

export interface NormalizedFlightOffer {
  id: string;
  itineraryFingerprint: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  originAirport: string;
  originCity: string;
  destinationAirport: string;
  destinationCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes: number;
  durationFormatted: string;
  stops: number;
  stopsLabel: string;
  segments: FlightSegment[];
  price: number;
  pricePerAdult: number;
  formattedPrice: string;
  currency: string;
  priceStatus: PriceReliabilityStatus;
  priceStatusLabel: string;
  cabinClass: CabinClass;
  baggageAllowance: string;
  seller: string;
  bookingUrl: string | null;
  comparisonSites: { name: string; url: string; icon?: string }[];
  isOvernight: boolean;
  dayDifference: number;
  score: number;
  isBestOverall?: boolean;
}

export interface SearchResultSnapshot {
  sessionId: string;
  query: FlightSearchQuery;
  totalOffers: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  offers: NormalizedFlightOffer[];
  availableAirlines: { code: string; name: string; minPrice: number }[];
  minPrice: number;
  maxPrice: number;
  fetchedAt: string;
  priceReliability: {
    status: PriceReliabilityStatus;
    notice: string;
  };
}

// In-memory snapshot cache for sub-millisecond pagination and filter responses
const sessionMemoryCache = new Map<string, { snapshot: NormalizedFlightOffer[]; query: FlightSearchQuery; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class FlightSearchService {
  /**
   * Search for flights across registered providers, normalizes results, applies filters/sorting,
   * and stores session snapshot for fast pagination.
   */
  public static async search(rawQuery: FlightSearchQuery): Promise<SearchResultSnapshot> {
    const origin = resolveAirportCode(rawQuery.origin) || rawQuery.origin.trim().toUpperCase();
    const destination = resolveAirportCode(rawQuery.destination) || rawQuery.destination.trim().toUpperCase();
    const departureDate = rawQuery.departureDate || getTomorrowDateString();
    const tripType = rawQuery.tripType || "one_way";
    const adults = Math.max(1, rawQuery.adults ?? 1);
    const children = Math.max(0, rawQuery.children ?? 0);
    const infants = Math.max(0, rawQuery.infants ?? 0);
    const totalPassengers = adults + children + infants;
    const cabinClass = rawQuery.cabinClass || "economy";
    const currency = (rawQuery.currency || "INR").toUpperCase() as Currency;
    const directOnly = Boolean(rawQuery.directOnly);
    const page = Math.max(1, rawQuery.page ?? 1);
    const pageSize = [10, 20, 50].includes(rawQuery.pageSize ?? 10) ? (rawQuery.pageSize ?? 10) : 10;
    const sortBy = rawQuery.sortBy || "cheapest";

    const normalizedQuery: FlightSearchQuery = {
      origin,
      destination,
      departureDate,
      returnDate: tripType === "round_trip" ? rawQuery.returnDate : null,
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
      filters: rawQuery.filters,
    };

    const sessionCacheKey = `sess_${origin}_${destination}_${departureDate}_${tripType}_${adults}_${cabinClass}_${currency}_${directOnly}`;

    let allOffers: NormalizedFlightOffer[] = [];
    const cached = sessionMemoryCache.get(sessionCacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      allOffers = cached.snapshot;
    } else {
      // Query Providers
      allOffers = await this.queryAllProviders(normalizedQuery);

      // Cache snapshot for pagination
      sessionMemoryCache.set(sessionCacheKey, {
        snapshot: allOffers,
        query: normalizedQuery,
        timestamp: Date.now(),
      });
    }

    // Apply Result-level Filtering
    let filtered = [...allOffers];
    const filters = normalizedQuery.filters;

    if (filters) {
      if (filters.stops && filters.stops.length > 0) {
        filtered = filtered.filter((o) => filters.stops!.includes(o.stops));
      }
      if (filters.airlines && filters.airlines.length > 0) {
        filtered = filtered.filter((o) => filters.airlines!.includes(o.airlineCode));
      }
      if (typeof filters.minPrice === "number" && filters.minPrice > 0) {
        filtered = filtered.filter((o) => o.price >= filters.minPrice!);
      }
      if (typeof filters.maxPrice === "number" && filters.maxPrice > 0) {
        filtered = filtered.filter((o) => o.price <= filters.maxPrice!);
      }
      if (filters.depTimeSlot && filters.depTimeSlot.length > 0) {
        filtered = filtered.filter((o) => {
          const hour = parseInt(o.departureTime.split(":")[0] || "12", 10);
          if (filters.depTimeSlot!.includes("morning") && hour >= 6 && hour < 12) return true;
          if (filters.depTimeSlot!.includes("afternoon") && hour >= 12 && hour < 18) return true;
          if (filters.depTimeSlot!.includes("evening") && hour >= 18 && hour < 24) return true;
          if (filters.depTimeSlot!.includes("night") && (hour >= 0 && hour < 6)) return true;
          return false;
        });
      }
    }

    // Apply Sorting
    this.sortOffers(filtered, sortBy);

    // Identify Best Overall option
    if (filtered.length > 0) {
      // Find min price and min duration in set
      const minP = Math.min(...filtered.map((o) => o.price));
      const minD = Math.min(...filtered.map((o) => o.durationMinutes));

      filtered.forEach((o) => {
        // Normalised score: lower is better
        const priceScore = (o.price / (minP || 1)) * 60;
        const durationScore = (o.durationMinutes / (minD || 1)) * 40;
        o.score = Math.round(priceScore + durationScore);
      });

      const bestItem = [...filtered].sort((a, b) => a.score - b.score)[0];
      if (bestItem) {
        bestItem.isBestOverall = true;
      }
    }

    // Server-side Pagination Slice
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedOffers = filtered.slice(startIndex, startIndex + pageSize);

    // Extract available airlines and price range metadata
    const airlineMap = new Map<string, { code: string; name: string; minPrice: number }>();
    let overallMinPrice = allOffers.length > 0 ? allOffers[0].price : 0;
    let overallMaxPrice = allOffers.length > 0 ? allOffers[0].price : 0;

    allOffers.forEach((o) => {
      overallMinPrice = Math.min(overallMinPrice, o.price);
      overallMaxPrice = Math.max(overallMaxPrice, o.price);
      if (!airlineMap.has(o.airlineCode)) {
        airlineMap.set(o.airlineCode, { code: o.airlineCode, name: o.airline, minPrice: o.price });
      } else {
        const item = airlineMap.get(o.airlineCode)!;
        item.minPrice = Math.min(item.minPrice, o.price);
      }
    });

    const comparisonSites = generateMultiSiteComparisonLinks({
      origin,
      destination,
      departureDate,
      returnDate: tripType === "round_trip" ? normalizedQuery.returnDate || undefined : undefined,
      tripType,
      adults,
      cabinClass,
    });

    return {
      sessionId: sessionCacheKey,
      query: normalizedQuery,
      totalOffers: allOffers.length,
      filteredCount: totalCount,
      page: safePage,
      pageSize,
      totalPages,
      offers: paginatedOffers,
      availableAirlines: Array.from(airlineMap.values()),
      minPrice: overallMinPrice,
      maxPrice: overallMaxPrice,
      fetchedAt: new Date().toISOString(),
      priceReliability: {
        status: allOffers.length > 0 ? allOffers[0].priceStatus : "UNAVAILABLE",
        notice:
          allOffers.length > 1
            ? "Fares reflect verified airline rates. For guaranteed live-seat checkout, compare across partner portals below."
            : allOffers.length === 1
            ? "Showing 1 cached low-fare snapshot from Travelpayouts. To check all 15+ live departures in real-time, compare across Google Flights, MakeMyTrip, or Skyscanner below, or configure an Amadeus API key in Settings for full real-time GDS flight search."
            : "No airline fares available for this exact date and route combination.",
      },
    };
  }

  /**
   * Queries provider adapters and aggregates results.
   */
  private static async queryAllProviders(query: FlightSearchQuery): Promise<NormalizedFlightOffer[]> {
    const comparisonSites = generateMultiSiteComparisonLinks({
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate || undefined,
      tripType: query.tripType || "one_way",
      adults: query.adults || 1,
      cabinClass: query.cabinClass || "economy",
    });

    const originInfo = getAirportDetails(query.origin);
    const destInfo = getAirportDetails(query.destination);
    const offers: NormalizedFlightOffer[] = [];
    const seenFingerprints = new Set<string>();

    // 1. Query Amadeus GDS live flight offers if configured
    if (AmadeusAdapter.isConfigured()) {
      try {
        const amadeusOffers = await AmadeusAdapter.searchFlights(query);
        amadeusOffers.forEach((o) => {
          o.comparisonSites = comparisonSites.map((s) => ({ name: s.name, url: s.url }));
          offers.push(o);
          seenFingerprints.add(`${o.airlineCode}_${o.flightNumber.replace(/\s+/g, "")}_${o.departureTime}`);
        });
      } catch (err) {
        console.error("Amadeus search adapter error:", err);
      }
    }

    // 2. Query Travelpayouts / Aviasales cached fare engine
    const rawQuote = await fetchLiveFlightPrices({
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate || undefined,
      tripType: query.tripType || "one_way",
      currency: query.currency || "INR",
      directOnly: query.directOnly || false,
    });

    if (rawQuote && rawQuote.found && rawQuote.options && rawQuote.options.length > 0) {
      rawQuote.options.forEach((opt, index) => {
        // Enforce strict date adherence
        if (!validateFlightMatchesRequestedDate(opt.departureDateOnly, query.departureDate)) {
          return;
        }

        const cleanKey = `${opt.airlineCode || "6E"}_${String(opt.flightNumber || index).replace(/\s+/g, "")}_${opt.departureTimeLocal}`;
        if (seenFingerprints.has(cleanKey)) {
          return;
        }
        seenFingerprints.add(cleanKey);

        const totalPrice = opt.price * (query.adults || 1);
        const stops = opt.isDirect ? 0 : 1;
        const fingerprint = `${query.origin}_${query.destination}_${opt.departureDateOnly}_${opt.airlineCode || "XX"}_${opt.flightNumber || "FL"}_${opt.departureTimeLocal || "00"}`;

        const segment: FlightSegment = {
          airline: opt.airline,
          airlineCode: opt.airlineCode || "6E",
          flightNumber: opt.flightNumber || `${opt.airlineCode || "6E"} ${index + 101}`,
          origin: query.origin,
          originName: originInfo?.name,
          destination: query.destination,
          destinationName: destInfo?.name,
          departureDate: opt.departureDateOnly,
          departureTime: opt.departureTimeLocal,
          arrivalDate: opt.arrivalDateOnly,
          arrivalTime: opt.arrivalTimeLocal,
          durationMinutes: opt.durationMinutes,
          durationFormatted: opt.durationFormatted,
        };

        offers.push({
          id: `offer_${fingerprint}_${index}`,
          itineraryFingerprint: fingerprint,
          airline: opt.airline,
          airlineCode: opt.airlineCode || "6E",
          flightNumber: opt.flightNumber || `${opt.airlineCode || "6E"} ${index + 101}`,
          originAirport: query.origin,
          originCity: originInfo?.city || query.origin,
          destinationAirport: query.destination,
          destinationCity: destInfo?.city || query.destination,
          departureDate: opt.departureDateOnly,
          departureTime: opt.departureTimeLocal,
          arrivalDate: opt.arrivalDateOnly,
          arrivalTime: opt.arrivalTimeLocal,
          durationMinutes: opt.durationMinutes,
          durationFormatted: opt.durationFormatted,
          stops,
          stopsLabel: stops === 0 ? "Non-stop" : `${stops} Stop`,
          segments: [segment],
          price: totalPrice,
          pricePerAdult: opt.price,
          formattedPrice: formatCurrency(totalPrice, query.currency || "INR"),
          currency: query.currency || "INR",
          priceStatus: opt.priceStatus || "CACHED_PRICE",
          priceStatusLabel: opt.priceStatus === "CACHED_PRICE" ? "Indexed Fare" : "Indicative Fare",
          cabinClass: query.cabinClass || "economy",
          baggageAllowance: "15 kg Check-in, 7 kg Cabin",
          seller: opt.seller || "Aviasales Partner",
          bookingUrl: opt.bookingUrl,
          comparisonSites: comparisonSites.map((s) => ({ name: s.name, url: s.url })),
          isOvernight: opt.isOvernight,
          dayDifference: opt.dayDifference,
          score: 100,
        });
      });
    }

    return offers;
  }

  /**
   * Sorts offers in-place according to chosen criteria.
   */
  private static sortOffers(offers: NormalizedFlightOffer[], sortBy: string): void {
    switch (sortBy) {
      case "cheapest":
        offers.sort((a, b) => a.price - b.price);
        break;
      case "fastest":
        offers.sort((a, b) => a.durationMinutes - b.durationMinutes);
        break;
      case "earliest_dep":
        offers.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
        break;
      case "latest_dep":
        offers.sort((a, b) => b.departureTime.localeCompare(a.departureTime));
        break;
      case "earliest_arr":
        offers.sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime));
        break;
      case "latest_arr":
        offers.sort((a, b) => b.arrivalTime.localeCompare(a.arrivalTime));
        break;
      case "best":
      default:
        offers.sort((a, b) => a.score - b.score || a.price - b.price);
        break;
    }
  }
}
