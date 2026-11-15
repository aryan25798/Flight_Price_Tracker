import { describe, it, expect } from "vitest";
import { pollSingleRoute } from "@/lib/flights/poller";

const isConfigured = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
);

describe("Flight Price Polling Engine", () => {
  it.skipIf(!isConfigured)(
    "successfully updates monitored route and tracked flights with live fares",
    async () => {
      // Route ID for MAA -> PAT 2026-11-26
      const routeId = "3d675717-1fb1-4dc1-99da-5402effea903";
      const result = await pollSingleRoute(routeId);

      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      expect(result.routeId).toBe(routeId);
      expect(result.price).toBeGreaterThan(0);
      expect(typeof result.airline).toBe("string");
      console.log("Polled route result:", result);
    },
    30000
  );
});
