import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UsersManager } from "@/components/admin/users-manager";
import { SettingsForm } from "@/components/admin/settings-form";
import { FlightSearchForm } from "@/components/dashboard/flight-search-form";
import type { Profile, UserQuota } from "@/types/database";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock admin actions
const mockUpdateUserTier = vi.fn().mockResolvedValue({ ok: true });
const mockTestSmtp = vi.fn().mockResolvedValue({ ok: true, message: "Test email sent!" });
const mockAdminDispatch = vi.fn().mockResolvedValue({ ok: true });

vi.mock("@/app/admin/actions", () => ({
  updateUserTierAction: (...args: unknown[]) => mockUpdateUserTier(...args),
  testSmtpConnectionAction: (...args: unknown[]) => mockTestSmtp(...args),
  adminActionDispatch: (...args: unknown[]) => mockAdminDispatch(...args),
}));

const mockUsers: Profile[] = [
  {
    id: "usr-1",
    email: "freeuser@aerodrop.io",
    role: "user",
    tier: "free",
    custom_tracker_limit: null,
    tier_notes: null,
    is_banned: false,
    telegram_chat_id: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  },
  {
    id: "usr-2",
    email: "prouser@aerodrop.io",
    role: "user",
    tier: "pro",
    custom_tracker_limit: null,
    tier_notes: "Early beta VIP",
    is_banned: false,
    telegram_chat_id: "12345678",
    created_at: "2026-11-05T10:00:00Z",
    updated_at: "2026-11-05T10:00:00Z",
  },
  {
    id: "usr-3",
    email: "enterprise@agency.com",
    role: "user",
    tier: "enterprise",
    custom_tracker_limit: -1,
    tier_notes: "Travel Agency License",
    is_banned: false,
    telegram_chat_id: "87654321",
    created_at: "2026-11-10T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
  },
];

describe("AeroDrop 2.0 Admin Tier & Custom Quota Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("UsersManager Component", () => {
    it("renders Plan Tier and Active Quota columns in the user directory", () => {
      render(
        <UsersManager
          users={mockUsers}
          total={3}
          page={1}
          pageSize={10}
          currentAdminId="admin-id"
          initialSearch=""
          initialStatus="all"
        />,
      );

      // Verify headers
      expect(screen.getByText("Plan Tier")).toBeInTheDocument();
      expect(screen.getByText("Active Quota")).toBeInTheDocument();

      // Verify plan badges
      expect(screen.getAllByText(/Free Tier/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Pro Plan/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Enterprise/i).length).toBeGreaterThanOrEqual(1);

      // Verify quota displays
      expect(screen.getAllByText(/3 Trackers/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/25 Trackers/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Unlimited/i).length).toBeGreaterThanOrEqual(1);
    });

    it("opens Tier & Quota modal when button is clicked and allows saving changes", async () => {
      render(
        <UsersManager
          users={mockUsers}
          total={3}
          page={1}
          pageSize={10}
          currentAdminId="admin-id"
          initialSearch=""
          initialStatus="all"
        />,
      );

      // Click first "Tier & Quota" button
      const tierButtons = screen.getAllByRole("button", { name: /Tier & Quota/i });
      fireEvent.click(tierButtons[0]);

      // Verify modal content
      expect(screen.getByText("Subscription Tier & Quota Control")).toBeInTheDocument();
      expect(screen.getByText("Select Platform Plan Tier")).toBeInTheDocument();
      expect(screen.getByText("Tracker Quota Capacity Allocation")).toBeInTheDocument();
      expect(screen.getByText("Tier Default Allocation")).toBeInTheDocument();
      expect(screen.getByText("Custom Tracker Quota")).toBeInTheDocument();
      expect(screen.getByText(/Unlimited Trackers \(∞\)/i)).toBeInTheDocument();

      // Click Save Tier & Quota
      const saveButton = screen.getByRole("button", { name: /Save Tier & Quota/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateUserTier).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "usr-1",
            tier: "free",
          }),
        );
      });
    });
  });

  describe("SettingsForm SMTP Diagnostics", () => {
    it("renders Custom SMTP Email Engine Diagnostics and triggers test email dispatch", async () => {
      render(
        <SettingsForm
          initial={{
            polling_interval_minutes: 240,
            max_api_calls_per_cycle: 50,
            max_concurrent_requests: 3,
            notification_cooldown_hours: 12,
            price_drop_threshold_percent: 5,
            price_history_retention_days: 90,
            max_trackers_per_user: 10,
            max_route_retries: 5,
            maintenance_mode: false,
          }}
        />,
      );

      // Verify SMTP diagnostics section
      expect(screen.getByText("Custom SMTP Email Engine Diagnostics")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter recipient email/i)).toBeInTheDocument();

      // Enter test email
      const input = screen.getByPlaceholderText(/Enter recipient email/i);
      fireEvent.change(input, { target: { value: "tester@example.com" } });

      // Click Send Test Email
      const sendBtn = screen.getByRole("button", { name: /Send Test Email/i });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(mockTestSmtp).toHaveBeenCalledWith("tester@example.com");
      });
    });
  });

  describe("FlightSearchForm Quota Capacity Awareness", () => {
    it("displays unlimited capacity for enterprise users and allows submission", () => {
      const quota: UserQuota = {
        tier: "enterprise",
        effective_limit: -1,
        current_count: 5,
        is_unlimited: true,
        remaining: 9999,
      };

      render(<FlightSearchForm quotaInfo={quota} />);

      expect(screen.getByText(/enterprise · Unlimited Trackers \(∞\)/i)).toBeInTheDocument();
      const submitBtn = screen.getByRole("button", { name: /Activate Route Tracker/i });
      expect(submitBtn).not.toBeDisabled();
    });

    it("displays quota reached warning and disables submission when limit is exhausted", () => {
      const quota: UserQuota = {
        tier: "free",
        effective_limit: 3,
        current_count: 3,
        is_unlimited: false,
        remaining: 0,
      };

      render(<FlightSearchForm quotaInfo={quota} />);

      expect(screen.getByText(/Active Tracker Quota Reached/i)).toBeInTheDocument();
      expect(
        screen.getByText(/You have reached your limit of 3 active trackers on the FREE tier/i),
      ).toBeInTheDocument();

      const disabledBtn = screen.getByRole("button", { name: /Quota Reached \(3\/3\)/i });
      expect(disabledBtn).toBeDisabled();
    });
  });
});
