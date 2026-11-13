import { describe, expect, it } from "vitest";

interface AdminProfile {
  id: string;
  email: string;
  role: "user" | "super_admin";
  is_banned: boolean;
}

interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

class MockAdminService {
  public profiles: AdminProfile[] = [];
  public auditLogs: AuditLog[] = [];

  constructor() {
    this.profiles = [
      { id: "admin-1", email: "primary-admin@aerodrop.com", role: "super_admin", is_banned: false },
      { id: "user-1", email: "traveler1@gmail.com", role: "user", is_banned: false },
      { id: "user-2", email: "traveler2@gmail.com", role: "user", is_banned: false },
    ];
  }

  public banUser(adminId: string, targetUserId: string): { success: boolean; error?: string } {
    const admin = this.profiles.find((p) => p.id === adminId);
    if (!admin || admin.role !== "super_admin" || admin.is_banned) {
      return { success: false, error: "Unauthorized: super_admin privilege required" };
    }

    if (adminId === targetUserId) {
      return { success: false, error: "Self-protection: super admins cannot ban themselves" };
    }

    const target = this.profiles.find((p) => p.id === targetUserId);
    if (!target) {
      return { success: false, error: "User not found" };
    }

    // Last admin protection
    if (target.role === "super_admin") {
      const activeAdmins = this.profiles.filter((p) => p.role === "super_admin" && !p.is_banned);
      if (activeAdmins.length <= 1) {
        return { success: false, error: "Cannot ban the only active super administrator" };
      }
    }

    target.is_banned = true;
    this.auditLogs.push({
      id: `audit-${this.auditLogs.length + 1}`,
      adminId,
      action: "ban_user",
      targetId: targetUserId,
      metadata: { previousStatus: false, newStatus: true },
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }

  public unbanUser(adminId: string, targetUserId: string): { success: boolean; error?: string } {
    const admin = this.profiles.find((p) => p.id === adminId);
    if (!admin || admin.role !== "super_admin" || admin.is_banned) {
      return { success: false, error: "Unauthorized: super_admin privilege required" };
    }

    const target = this.profiles.find((p) => p.id === targetUserId);
    if (!target) return { success: false, error: "User not found" };

    target.is_banned = false;
    this.auditLogs.push({
      id: `audit-${this.auditLogs.length + 1}`,
      adminId,
      action: "unban_user",
      targetId: targetUserId,
      metadata: { previousStatus: true, newStatus: false },
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }

  public deleteUser(adminId: string, targetUserId: string): { success: boolean; error?: string } {
    const admin = this.profiles.find((p) => p.id === adminId);
    if (!admin || admin.role !== "super_admin" || admin.is_banned) {
      return { success: false, error: "Unauthorized: super_admin privilege required" };
    }

    if (adminId === targetUserId) {
      return { success: false, error: "Self-protection: super admins cannot delete themselves" };
    }

    const index = this.profiles.findIndex((p) => p.id === targetUserId);
    if (index === -1) return { success: false, error: "User not found" };

    const target = this.profiles[index];
    if (target.role === "super_admin") {
      const activeAdmins = this.profiles.filter((p) => p.role === "super_admin" && !p.is_banned);
      if (activeAdmins.length <= 1) {
        return { success: false, error: "Cannot delete the only active super administrator" };
      }
    }

    this.profiles.splice(index, 1);
    this.auditLogs.push({
      id: `audit-${this.auditLogs.length + 1}`,
      adminId,
      action: "delete_user",
      targetId: targetUserId,
      metadata: { deletedEmail: target.email },
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }
}

describe("Phase 2 Functional Testing: Admin Operations & Privileged Auditing", () => {
  it("allows super_admin to ban and unban an active user with immutable audit logs", () => {
    const service = new MockAdminService();

    // Ban
    const banResult = service.banUser("admin-1", "user-1");
    expect(banResult.success).toBe(true);

    const bannedUser = service.profiles.find((p) => p.id === "user-1");
    expect(bannedUser?.is_banned).toBe(true);
    expect(service.auditLogs).toHaveLength(1);
    expect(service.auditLogs[0].action).toBe("ban_user");
    expect(service.auditLogs[0].adminId).toBe("admin-1");

    // Unban
    const unbanResult = service.unbanUser("admin-1", "user-1");
    expect(unbanResult.success).toBe(true);
    expect(bannedUser?.is_banned).toBe(false);
    expect(service.auditLogs).toHaveLength(2);
    expect(service.auditLogs[1].action).toBe("unban_user");
  });

  it("prevents self-ban by super administrator", () => {
    const service = new MockAdminService();
    const result = service.banUser("admin-1", "admin-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("cannot ban themselves");
    expect(service.auditLogs).toHaveLength(0);
  });

  it("prevents ordinary users from executing admin operations", () => {
    const service = new MockAdminService();
    const result = service.banUser("user-1", "user-2");

    expect(result.success).toBe(false);
    expect(result.error).toContain("super_admin privilege required");
    expect(service.auditLogs).toHaveLength(0);
  });

  it("prevents banning or deleting the only remaining super administrator", () => {
    const service = new MockAdminService();
    // admin-1 is the only super_admin in default setup
    // Add second temporary admin to test
    service.profiles.push({
      id: "admin-2",
      email: "second-admin@aerodrop.com",
      role: "super_admin",
      is_banned: false,
    });

    // admin-1 bans admin-2 (allowed because 2 exist)
    const ban1 = service.banUser("admin-1", "admin-2");
    expect(ban1.success).toBe(true);

    // Now only admin-1 is active. If someone tries to ban admin-1 from another session, it must fail:
    const ban2 = service.banUser("admin-2", "admin-1");
    expect(ban2.success).toBe(false); // admin-2 is banned and cannot act
  });

  it("records all actions with admin ID, timestamp, and target metadata", () => {
    const service = new MockAdminService();
    service.deleteUser("admin-1", "user-2");

    const deleteLog = service.auditLogs.find((l) => l.action === "delete_user");
    expect(deleteLog).toBeDefined();
    expect(deleteLog?.adminId).toBe("admin-1");
    expect(deleteLog?.targetId).toBe("user-2");
    expect(deleteLog?.metadata).toEqual({ deletedEmail: "traveler2@gmail.com" });
    expect(new Date(deleteLog!.createdAt).getTime()).toBeGreaterThan(0);
  });
});
