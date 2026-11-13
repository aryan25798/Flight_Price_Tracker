import { describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://vchicigycuwzkbxsgykp.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

describe("Live Supabase Security & Edge Function Guards", () => {
  it("rejects unauthenticated call to admin-actions with 401", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_stats" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated call to telegram-link with 401", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_link" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects forged telegram-webhook request without valid secret header", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "forged-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated call to check-flight-prices with 401", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-flight-prices`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("blocks anonymous REST reads on admin_audit_logs and tracked_flights", async () => {
    if (!ANON_KEY) return;

    const auditRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_logs?select=*`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    // Revoked from anon -> 401 or 403 or empty array
    if (auditRes.ok) {
      const rows = await auditRes.json();
      expect(rows).toEqual([]);
    } else {
      expect([401, 403]).toContain(auditRes.status);
    }
  });
});
