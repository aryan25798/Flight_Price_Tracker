import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildUserTools } from "@/lib/ai/tools/user-tools";
import { buildAdminTools } from "@/lib/ai/tools/admin-tools";
import { AI_CONFIG, USER_COPILOT_SYSTEM_PROMPT, ADMIN_COPILOT_SYSTEM_PROMPT } from "@/lib/ai/config";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";
import type { Profile } from "@/types/database";

describe("AeroDrop AI 2.0 Security, Database Access & Copilot Suite", () => {
  const mockUser = { id: "user-uuid-123", email: "traveler@example.com" };
  const mockProfile: Profile = {
    id: "user-uuid-123",
    email: "traveler@example.com",
    role: "user",
    tier: "free",
    custom_tracker_limit: null,
    is_banned: false,
    telegram_chat_id: "987654321",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const mockAdminProfile: Profile = {
    ...mockProfile,
    id: "admin-uuid-999",
    email: "superadmin@example.com",
    role: "super_admin",
  };

  it("enforces user isolation by binding queries strictly to ctx.user.id", async () => {
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "track-1",
          origin: "DEL",
          destination: "LHR",
          departure_date: "2026-12-15",
          currency: "INR",
          target_price: 45000,
          last_seen_price: 42000,
          is_active: true,
        },
      ],
      error: null,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        order: mockOrder,
      }),
    };

    const tools = buildUserTools({
      user: mockUser,
      profile: mockProfile,
      supabase: mockSupabase as any,
    });

    const res = await (tools.get_my_trackers.execute as any)({ status: "all" });

    // Assert that the database query filtered on user_id = mockUser.id
    expect(mockEq).toHaveBeenCalledWith("user_id", mockUser.id);
    expect(res.total).toBe(1);
    expect(res.trackers[0].route).toBe("DEL → LHR");
    expect(res.trackers[0].targetMet).toBe(true);
  });

  it("requires explicit user confirmation for consequential actions (create_tracker)", async () => {
    const mockSupabase = { from: vi.fn() };
    const tools = buildUserTools({
      user: mockUser,
      profile: mockProfile,
      supabase: mockSupabase as any,
    });

    const proposal = await (tools.create_tracker.execute as any)({
      origin: "DEL",
      destination: "SIN",
      departureDate: "2026-11-25",
      tripType: "one_way",
      currency: "INR",
      targetPrice: 20000,
    });

    // Propose only; zero DB write without user interactive confirmation
    expect(proposal.type).toBe("action_proposal");
    expect(proposal.action).toBe("create_tracker");
    expect(proposal.requiresUserConfirmation).toBe(true);
    expect(proposal.details.origin).toBe("DEL");
    expect(proposal.details.destination).toBe("SIN");
    expect(proposal.details.targetPrice).toBe(20000);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before deleting a flight tracker", async () => {
    const mockTracker = {
      id: "target-track-id",
      origin: "BOM",
      destination: "DXB",
      departure_date: "2026-12-01",
      currency: "INR",
      target_price: 18000,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTracker, error: null }),
      }),
    };

    const tools = buildUserTools({
      user: mockUser,
      profile: mockProfile,
      supabase: mockSupabase as any,
    });

    const proposal = await (tools.delete_tracker.execute as any)({
      trackerId: "target-track-id",
    });

    expect(proposal.type).toBe("action_proposal");
    expect(proposal.action).toBe("delete_tracker");
    expect(proposal.requiresUserConfirmation).toBe(true);
    expect(proposal.confirmationMessage).toContain("BOM → DXB");
  });

  it("blocks non-admin users from accessing administrative tool suite", () => {
    const mockSupabase = { from: vi.fn() };

    // Regular user attempting to construct admin tools
    expect(() =>
      buildAdminTools({
        user: mockUser,
        profile: mockProfile, // role: 'user'
        supabase: mockSupabase as any,
      })
    ).toThrowError(/Unauthorized: Admin tools require super_admin privileges/i);
  });

  it("allows super_admin to access administrative telemetry tools", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          total_users: 150,
          active_users: 142,
          total_trackers: 410,
          active_trackers: 380,
          unique_monitored_routes: 92,
          total_api_requests: 1200,
          total_provider_failures: 4,
          last_successful_poll: "2026-11-14T10:00:00Z",
        },
        error: null,
      }),
    };

    const adminTools = buildAdminTools({
      user: { id: mockAdminProfile.id, email: mockAdminProfile.email },
      profile: mockAdminProfile,
      supabase: mockSupabase as any,
    });

    expect(adminTools.get_system_health).toBeDefined();
    const health = await (adminTools.get_system_health.execute as any)({});
    expect(health.status).toBe("HEALTHY");
    expect(health.totalApiRequests).toBe(1200);
    expect(health.providerDropouts).toBe(4);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_admin_dashboard_stats");
  });

  it("enforces sliding-window rate limits against prompt flooding", () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000); // 3 requests per minute
    const key = "test_user_ai";

    expect(limiter.check(key).allowed).toBe(true);
    expect(limiter.check(key).allowed).toBe(true);
    expect(limiter.check(key).allowed).toBe(true);

    const blocked = limiter.check(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("validates that system prompts strictly prohibit SQL execution and data fabrication", () => {
    expect(USER_COPILOT_SYSTEM_PROMPT).toContain("You NEVER execute arbitrary SQL queries");
    expect(USER_COPILOT_SYSTEM_PROMPT).toContain("You NEVER fabricate flight prices");
    expect(USER_COPILOT_SYSTEM_PROMPT).toContain("SENSITIVE ACTIONS REQUIRE TWO-PHASE CONFIRMATION");
    expect(USER_COPILOT_SYSTEM_PROMPT).toContain("PRESENTING BOOKING & COMPARISON LINKS");
    expect(USER_COPILOT_SYSTEM_PROMPT).toContain("NEVER write raw URLs");

    expect(ADMIN_COPILOT_SYSTEM_PROMPT).toContain("You NEVER reveal user passwords");
    expect(ADMIN_COPILOT_SYSTEM_PROMPT).toContain("Every metric");
  });

  it("enforces AI configuration limits for zero-cost operation", () => {
    expect(AI_CONFIG.maxOutputTokens).toBeLessThanOrEqual(2048);
    expect(AI_CONFIG.temperature).toBeLessThanOrEqual(0.3);
    expect(AI_CONFIG.maxToolHopsPerTurn).toBe(4);
    expect(AI_CONFIG.rateLimits.rpmPerUser).toBe(10);
  });
});
