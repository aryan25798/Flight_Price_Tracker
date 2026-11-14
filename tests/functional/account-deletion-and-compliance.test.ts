import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase Server
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockDeleteProfile = vi.fn();
const mockDeletePush = vi.fn();
const mockAdminDeleteUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  })),
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "push_subscriptions") {
        return {
          delete: () => ({
            eq: mockDeletePush.mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          delete: () => ({
            eq: mockDeleteProfile.mockResolvedValue({ error: null }),
          }),
        };
      }
      return { delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
    },
    auth: {
      admin: {
        deleteUser: mockAdminDeleteUser.mockResolvedValue({ error: null }),
      },
    },
  })),
}));

describe("AeroDrop GDPR Article 17 Self-Service Account Deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated deletion requests with 401", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No session" } });

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects requests missing explicit 'DELETE' confirmation with 400", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "test-user-uuid-123", email: "test@user.com" } }, error: null });

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "incorrect" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("DELETE");
  });

  it("executes atomic account erasure and terminates session when confirmed", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "test-user-uuid-123", email: "test@user.com" } }, error: null });

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockDeleteProfile).toHaveBeenCalled();
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("test-user-uuid-123");
    expect(mockSignOut).toHaveBeenCalled();
  });
});
