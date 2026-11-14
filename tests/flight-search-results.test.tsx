import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlightSearchResults } from "@/components/dashboard/flight-search-results";
import type { SearchResultSnapshot, NormalizedFlightOffer } from "@/lib/flights/search-service";

describe("AeroDrop Flight Search Results Component Suite (Phase 5)", () => {
  const mockOffer1: NormalizedFlightOffer = {
    id: "offer_1",
    itineraryFingerprint: "DEL_PAT_2026-11-20_6E_6245_0620",
    airline: "IndiGo",
    airlineCode: "6E",
    flightNumber: "6E 6245",
    originAirport: "DEL",
    originCity: "New Delhi",
    destinationAirport: "PAT",
    destinationCity: "Patna",
    departureDate: "2026-11-20",
    departureTime: "06:20",
    arrivalDate: "2026-11-20",
    arrivalTime: "08:05",
    durationMinutes: 105,
    durationFormatted: "1h 45m",
    stops: 0,
    stopsLabel: "Non-stop",
    segments: [],
    price: 6422,
    pricePerAdult: 6422,
    formattedPrice: "₹6,422",
    currency: "INR",
    priceStatus: "CACHED_PRICE",
    priceStatusLabel: "Indexed Fare",
    cabinClass: "economy",
    baggageAllowance: "15 kg Check-in, 7 kg Cabin",
    seller: "IndiGo Direct",
    bookingUrl: "https://goindigo.in",
    comparisonSites: [
      { name: "Google Flights", url: "https://google.com/travel/flights" },
      { name: "Skyscanner", url: "https://skyscanner.co.in" },
      { name: "MakeMyTrip", url: "https://makemytrip.com" },
    ],
    isOvernight: false,
    dayDifference: 0,
    score: 85,
    isBestOverall: true,
  };

  const mockOffer2: NormalizedFlightOffer = {
    id: "offer_2",
    itineraryFingerprint: "DEL_PAT_2026-11-20_AI_407_1430",
    airline: "Air India",
    airlineCode: "AI",
    flightNumber: "AI 407",
    originAirport: "DEL",
    originCity: "New Delhi",
    destinationAirport: "PAT",
    destinationCity: "Patna",
    departureDate: "2026-11-20",
    departureTime: "14:30",
    arrivalDate: "2026-11-20",
    arrivalTime: "16:15",
    durationMinutes: 105,
    durationFormatted: "1h 45m",
    stops: 0,
    stopsLabel: "Non-stop",
    segments: [],
    price: 7150,
    pricePerAdult: 7150,
    formattedPrice: "₹7,150",
    currency: "INR",
    priceStatus: "LIVE_SEARCH_PRICE",
    priceStatusLabel: "Live Fare",
    cabinClass: "economy",
    baggageAllowance: "15 kg Check-in, 7 kg Cabin",
    seller: "Air India Portal",
    bookingUrl: null,
    comparisonSites: [
      { name: "Google Flights", url: "https://google.com/travel/flights" },
    ],
    isOvernight: false,
    dayDifference: 0,
    score: 95,
  };

  const mockSnapshot: SearchResultSnapshot = {
    sessionId: "sess_DEL_PAT_2026-11-20",
    query: {
      origin: "DEL",
      destination: "PAT",
      departureDate: "2026-11-20",
      tripType: "one_way",
      adults: 1,
      cabinClass: "economy",
      currency: "INR",
    },
    totalOffers: 25,
    filteredCount: 25,
    page: 1,
    pageSize: 10,
    totalPages: 3,
    offers: [mockOffer1, mockOffer2],
    availableAirlines: [
      { code: "6E", name: "IndiGo", minPrice: 6422 },
      { code: "AI", name: "Air India", minPrice: 7150 },
    ],
    minPrice: 6422,
    maxPrice: 12500,
    fetchedAt: "2026-11-20T10:00:00Z",
    priceReliability: {
      status: "CACHED_PRICE",
      notice: "Indexed 48h Fare Snapshot",
    },
  };

  it("renders flight cards with flight details, times, prices, and badges", () => {
    render(
      <FlightSearchResults
        results={mockSnapshot}
        loading={false}
        currency="INR"
        onSelectExactFlight={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        activeSort="cheapest"
      />
    );

    expect(screen.getByText(/DEL → PAT/i)).toBeInTheDocument();
    expect(screen.getByText("IndiGo")).toBeInTheDocument();
    expect(screen.getByText("6E 6245")).toBeInTheDocument();
    expect(screen.getByText("06:20")).toBeInTheDocument();
    expect(screen.getByText("08:05")).toBeInTheDocument();
    expect(screen.getByText("₹6,422")).toBeInTheDocument();

    expect(screen.getByText("Air India")).toBeInTheDocument();
    expect(screen.getByText("AI 407")).toBeInTheDocument();
    expect(screen.getByText("₹7,150")).toBeInTheDocument();
  });

  it("renders 'Best Overall Deal' badge for the top scored flight", () => {
    render(
      <FlightSearchResults
        results={mockSnapshot}
        loading={false}
        currency="INR"
        onSelectExactFlight={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        activeSort="best"
      />
    );

    expect(screen.getByText(/Best Overall Deal/i)).toBeInTheDocument();
  });

  it("fires onSelectExactFlight callback when 'Track This Flight' is clicked", () => {
    const handleSelect = vi.fn();
    render(
      <FlightSearchResults
        results={mockSnapshot}
        loading={false}
        currency="INR"
        onSelectExactFlight={handleSelect}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        activeSort="cheapest"
      />
    );

    const trackButtons = screen.getAllByRole("button", { name: /Track This Flight/i });
    expect(trackButtons.length).toBe(2);

    fireEvent.click(trackButtons[0]);
    expect(handleSelect).toHaveBeenCalledWith(mockOffer1);
  });

  it("renders comparison portal links opening in a new tab with target='_blank'", () => {
    render(
      <FlightSearchResults
        results={mockSnapshot}
        loading={false}
        currency="INR"
        onSelectExactFlight={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        activeSort="cheapest"
      />
    );

    const googleLinks = screen.getAllByRole("link", { name: /Google Flights/i });
    expect(googleLinks.length).toBeGreaterThan(0);
    expect(googleLinks[0]).toHaveAttribute("target", "_blank");
    expect(googleLinks[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("triggers onSortChange when user clicks a sorting tab", () => {
    const handleSort = vi.fn();
    render(
      <FlightSearchResults
        results={mockSnapshot}
        loading={false}
        currency="INR"
        onSelectExactFlight={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={handleSort}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        activeSort="cheapest"
      />
    );

    const fastestBtn = screen.getByRole("button", { name: /Fastest/i });
    fireEvent.click(fastestBtn);
    expect(handleSort).toHaveBeenCalledWith("fastest");
  });

  it("renders pagination bar when total offers exceed page size", () => {
    render(
      <FlightSearchResults
        results={mockSnapshot}
        loading={false}
        currency="INR"
        onSelectExactFlight={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        activeSort="cheapest"
      />
    );

    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
  });
});
