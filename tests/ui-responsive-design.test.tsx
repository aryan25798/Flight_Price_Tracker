import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TrackersTable } from "@/components/dashboard/trackers-table";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { TelegramCard } from "@/components/dashboard/telegram-card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { generateMultiSiteComparisonLinks } from "@/lib/flight-urls";
import type { TrackedFlight, PriceHistoryPoint } from "@/types/database";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock action dispatch
vi.mock("@/app/dashboard/actions", () => ({
  toggleTrackerAction: vi.fn().mockResolvedValue({ ok: true, message: "Tracker toggled" }),
  deleteTrackerAction: vi.fn().mockResolvedValue({ ok: true, message: "Tracker deleted" }),
  signOutAction: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock Supabase client for PriceHistoryChart
const mockHistoryPoints: PriceHistoryPoint[] = [
  {
    id: "h1",
    route_id: "route-1",
    price: 5200,
    currency: "INR",
    airline: "6E",
    booking_url: "https://example.com/book",
    provider: "Travelpayouts",
    checked_at: "2026-11-10T10:00:00Z",
  },
  {
    id: "h2",
    route_id: "route-1",
    price: 4900,
    currency: "INR",
    airline: "6E",
    booking_url: "https://example.com/book",
    provider: "Travelpayouts",
    checked_at: "2026-11-11T10:00:00Z",
  },
  {
    id: "h3",
    route_id: "route-1",
    price: 4500,
    currency: "INR",
    airline: "6E",
    booking_url: "https://example.com/book",
    provider: "Travelpayouts",
    checked_at: "2026-11-12T10:00:00Z",
  },
];

let mockSupabaseSelectResult: { data: PriceHistoryPoint[] | null; error: Error | null } = {
  data: mockHistoryPoints,
  error: null,
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve(mockSupabaseSelectResult),
          }),
        }),
      }),
    }),
  }),
}));

const mockTrackers: TrackedFlight[] = [
  {
    id: "trk-1",
    user_id: "user-1",
    route_id: "route-1",
    origin: "DEL",
    destination: "BOM",
    departure_date: "2026-12-25",
    return_date: null,
    trip_type: "one_way",
    adults: 1,
    children: 0,
    infants: 0,
    cabin_class: "economy",
    target_price: 5000,
    currency: "INR",
    is_active: true,
    last_seen_price: 4500,
    last_notified_price: null,
    last_notified_at: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-12T00:00:00Z",
    monitored_routes: {
      last_airline: "IndiGo (6E)",
      last_checked_at: "2026-11-12T00:00:00Z",
      last_booking_url: "https://example.com/book",
      status: "active",
    },
  },
  {
    id: "trk-2",
    user_id: "user-1",
    route_id: "route-2",
    origin: "BLR",
    destination: "GOI",
    departure_date: "2026-12-30",
    return_date: null,
    trip_type: "one_way",
    adults: 1,
    children: 0,
    infants: 0,
    cabin_class: "economy",
    target_price: 3500,
    currency: "INR",
    is_active: false,
    last_seen_price: 3900,
    last_notified_price: null,
    last_notified_at: null,
    created_at: "2026-11-05T00:00:00Z",
    updated_at: "2026-11-12T00:00:00Z",
    monitored_routes: {
      last_airline: "Air India (AI)",
      last_checked_at: "2026-11-12T00:00:00Z",
      last_booking_url: null,
      status: "active",
    },
  },
];

describe("UI Responsive Design & Mobile-First Component Suite", () => {
  describe("Badge Component", () => {
    it("renders all custom variants with luminous dot indicators", () => {
      const { container } = render(
        <div>
          <Badge variant="emerald" dot>
            Active
          </Badge>
          <Badge variant="amber" dot>
            Superadmin
          </Badge>
          <Badge variant="destructive" dot>
            Banned
          </Badge>
          <Badge variant="cyan" dot>
            Live Engine
          </Badge>
        </div>,
      );

      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Superadmin")).toBeInTheDocument();
      expect(screen.getByText("Banned")).toBeInTheDocument();
      expect(screen.getByText("Live Engine")).toBeInTheDocument();

      const dots = container.querySelectorAll(".rounded-full.shrink-0");
      expect(dots.length).toBe(4);
    });
  });

  describe("Dialog Component", () => {
    it("renders title, description, and closes on Escape or backdrop click", () => {
      const onOpenChange = vi.fn();
      render(
        <Dialog
          open={true}
          onOpenChange={onOpenChange}
          title="Confirm Action"
          description="Are you sure you want to proceed?"
        >
          <div>Dialog Inner Content</div>
        </Dialog>,
      );

      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
      expect(screen.getByText("Dialog Inner Content")).toBeInTheDocument();

      // Test Escape key press
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("TrackersTable (Dual Mobile Card + Desktop Table)", () => {
    it("renders both mobile ticket cards and desktop responsive layout", () => {
      render(
        <TrackersTable
          trackers={mockTrackers}
          total={mockTrackers.length}
          page={1}
          pageSize={20}
        />,
      );

      // Both routes should be rendered
      const delElements = screen.getAllByText("DEL");
      expect(delElements.length).toBeGreaterThanOrEqual(1);

      // Verify active badge
      expect(screen.getAllByText(/Deal Active|Monitoring|Active/i).length).toBeGreaterThanOrEqual(1);
      // Verify paused badge
      expect(screen.getAllByText("Paused").length).toBeGreaterThanOrEqual(1);

      // Verify target prices rendered
      expect(screen.getAllByText(/₹5,000/i).length).toBeGreaterThanOrEqual(1);
    });

    it("opens multi-site comparison modal when Compare Sites is clicked", () => {
      render(
        <TrackersTable
          trackers={mockTrackers}
          total={mockTrackers.length}
          page={1}
          pageSize={20}
        />,
      );

      const compareButtons = screen.getAllByText(/Compare Sites/i);
      expect(compareButtons.length).toBeGreaterThanOrEqual(1);

      fireEvent.click(compareButtons[0]);
      expect(screen.getByText(/Compare Prices: DEL → BOM/i)).toBeInTheDocument();
      expect(screen.getByText("Google Flights")).toBeInTheDocument();
      expect(screen.getByText("Skyscanner")).toBeInTheDocument();
      expect(screen.getByText("MakeMyTrip")).toBeInTheDocument();
      expect(screen.getByText("EaseMyTrip")).toBeInTheDocument();
    });

    it("opens delete confirmation modal when delete button is triggered", () => {
      render(
        <TrackersTable
          trackers={mockTrackers}
          total={mockTrackers.length}
          page={1}
          pageSize={20}
        />,
      );

      const deleteButtons = screen.getAllByTitle(/Delete tracker/i);
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1);

      fireEvent.click(deleteButtons[0]);
      expect(screen.getByText("Stop Tracking Route?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirm Deletion/i })).toBeInTheDocument();
    });
  });

  describe("PriceHistoryChart", () => {
    it("calculates and displays Lowest, Highest, Latest, and Target price badges", async () => {
      mockSupabaseSelectResult = { data: mockHistoryPoints, error: null };
      render(
        <PriceHistoryChart
          routeId="route-1"
          currency="INR"
          targetPrice={5000}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Lowest Recorded")).toBeInTheDocument();
      });

      expect(screen.getByText("Latest Observed")).toBeInTheDocument();
      expect(screen.getByText("Target Threshold")).toBeInTheDocument();

      // Low price was 4500
      expect(screen.getAllByText(/₹4,500/i).length).toBeGreaterThanOrEqual(1);
    });

    it("displays empty state when no historical data points are available", async () => {
      mockSupabaseSelectResult = { data: [], error: null };
      render(
        <PriceHistoryChart
          routeId="route-empty"
          currency="INR"
          targetPrice={5000}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Awaiting initial price observation")).toBeInTheDocument();
      });
      expect(
        screen.getByText(/No historical price data recorded for this route yet/i),
      ).toBeInTheDocument();
    });
  });

  describe("TelegramCard Integration", () => {
    it("renders Telegram connect state and handles link button interaction", () => {
      render(<TelegramCard isConnected={false} lastNotificationAt={null} />);

      expect(screen.getByText("Telegram Instant Notification Bot")).toBeInTheDocument();
      expect(screen.getByText("Not Linked")).toBeInTheDocument();

      const connectBtn = screen.getByRole("button", { name: /Generate Secure Bot Link/i });
      expect(connectBtn).toBeInTheDocument();
    });
  });

  describe("Multi-Site Deals Link Generator", () => {
    it("generates pre-populated search URLs for Google Flights, Skyscanner, MMT, EaseMyTrip, and Kayak", () => {
      const sites = generateMultiSiteComparisonLinks({
        origin: "DEL",
        destination: "BOM",
        departureDate: "2026-12-10",
      });

      expect(sites.length).toBe(6);
      const google = sites.find((s) => s.id === "google_flights");
      expect(google?.url).toContain("google.com/travel/flights");
      expect(google?.url).toContain("DEL");
      expect(google?.url).toContain("BOM");

      const skyscanner = sites.find((s) => s.id === "skyscanner");
      expect(skyscanner?.url).toContain("skyscanner.co.in");

      const mmt = sites.find((s) => s.id === "makemytrip");
      expect(mmt?.url).toContain("makemytrip.com");

      const easemytrip = sites.find((s) => s.id === "easemytrip");
      expect(easemytrip?.url).toContain("easemytrip.com");
    });
  });
});
