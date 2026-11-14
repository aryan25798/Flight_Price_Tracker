import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildUserTools } from "@/lib/ai/tools/user-tools";
import { buildAdminTools } from "@/lib/ai/tools/admin-tools";
import { AI_CONFIG, USER_COPILOT_SYSTEM_PROMPT, ADMIN_COPILOT_SYSTEM_PROMPT } from "@/lib/ai/config";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";
import { formatChatContent } from "@/components/ai/ai-copilot-drawer";
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

  it("strips leaked internal tool reasoning preambles from response", () => {
    const rawMess = `Now we have origin DEL, destination Pune (PNQ), date 2026-11-27. Need to search_flights. Use tool.Cheapest one-way flight from Delhi (DEL) to Pune (PNQ) on 2026-11-27:
• **Airline**: IndiGo (6E)
• **Flight**: 6E 2343
• **Departure**: 02:15 AM (DEL)
• **Price**: ₹6,834 INR`;

    const formatted = formatChatContent(rawMess);
    expect(formatted).not.toContain("Now we have origin DEL");
    expect(formatted).not.toContain("Use tool.");
    expect(formatted).toContain("Cheapest one-way flight from Delhi (DEL) to Pune (PNQ)");

    // Test leaked model self-dialogue preamble (e.g. "User just says hi. Need to respond politely, ask how can help.")
    const leakedDialogue = `User just says hi. Need to respond politely, ask how can help.Hello! 👏 How can I help you with flight searches, price-drop tracking, or savings insights today?`;
    const cleanedDialogue = formatChatContent(leakedDialogue);
    expect(cleanedDialogue).not.toContain("User just says hi");
    expect(cleanedDialogue).not.toContain("Need to respond politely");
    expect(cleanedDialogue).toBe("Hello! 👏 How can I help you with flight searches, price-drop tracking, or savings insights today?");
  });

  it("formats collapsed ASCII pipe tables into clean, structured bullet cards (Image 1 fix)", () => {
    const rawMess = `Sure! I can set up a price-drop tracker for you. I’ll need a few details:

| Detail | What I need ||--------|-------------|| Origin airport (3-letter IATA) | e.g., DEL, LHR || Destination airport (3-letter IATA) | e.g., SIN, JFK || Departure date (YYYY-MM-DD) || Trip type – one-way or round-trip || Return date (if round-trip, YYYY-MM-DD) || Target price (the price you’d like to be alerted at) || Currency – INR, USD, EUR, GBP, AED, SGD (default INR) | optional |

Please provide the missing information.`;

    const formatted = formatChatContent(rawMess);

    // Assert that raw pipes are removed and replaced by clean structured bullets
    expect(formatted).not.toContain("||--------|-------------||");
    expect(formatted).toContain("• **Origin airport (3-letter IATA)**: e.g., DEL, LHR");
    expect(formatted).toContain("• **Destination airport (3-letter IATA)**: e.g., SIN, JFK");
    expect(formatted).toContain("• **Departure date (YYYY-MM-DD)**");
    expect(formatted).toContain("• **Target price (the price you’d like to be alerted at)**");
  });

  it("converts raw bulleted comparison URLs into clean markdown links and strips token hashes (Image 3 fix)", () => {
    const rawUrls = `2ea3-8040-a76c-efedb5fb7b29&static_fare_key=TY%7CP0%7CH1%7CL0%7CCH0%7CR0%7CTBC0&itinerary_key=a-X0qxkr2fzoN_NVrVb2Hg
Quick comparison sites (for alternative offers):
• Google Flights:
https://www.google.com/travel/flights?q=Flights%20to%20PAT%20from%20DEL%20on%202026-11-24
• Skyscanner:
https://www.skyscanner.co.in/transport/flights/del/pat/261124/?adultsv2=1&cabinclass=economy
• MakeMyTrip:
https://www.makemytrip.com/flight/search?itinerary=DEL-PAT-24/11/2026`;

    const formatted = formatChatContent(rawUrls);

    expect(formatted).not.toContain("2ea3-8040-a76c-efedb5fb7b29&static_fare_key=");
    expect(formatted).toContain("[Compare on Google Flights](https://www.google.com/travel/flights?q=Flights%20to%20PAT%20from%20DEL%20on%202026-11-24)");
    expect(formatted).toContain("[Compare on Skyscanner](https://www.skyscanner.co.in/transport/flights/del/pat/261124/?adultsv2=1&cabinclass=economy)");
    expect(formatted).toContain("[Compare on MakeMyTrip](https://www.makemytrip.com/flight/search?itinerary=DEL-PAT-24/11/2026)");
  });

  it("handles exact flight tracking parameters in create_tracker proposal (Phase 6)", async () => {
    const mockSupabase = { from: vi.fn() };
    const tools = buildUserTools({
      user: mockUser,
      profile: mockProfile,
      supabase: mockSupabase as any,
    });

    const proposal = await (tools.create_tracker.execute as any)({
      origin: "delhi",
      destination: "patna",
      departureDate: "2026-11-20",
      targetPrice: 6500,
      trackingMode: "exact_flight",
      flightNumber: "6E-6245",
      airlineCode: "6E",
      airlineName: "IndiGo",
      departureTime: "06:20",
      arrivalTime: "08:00",
    });

    expect(proposal.type).toBe("action_proposal");
    expect(proposal.details.trackingMode).toBe("exact_flight");
    expect(proposal.details.flightNumber).toBe("6E-6245");
    expect(proposal.details.airlineCode).toBe("6E");
    expect(proposal.details.airlineName).toBe("IndiGo");
    expect(proposal.confirmationMessage).toContain("6E-6245");
  });
});
