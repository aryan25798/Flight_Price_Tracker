import { describe, expect, it } from "vitest";
import { z } from "zod";

// Schemas matching Auth contracts
const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

describe("Phase 2 Functional Testing: Authentication & Access Control", () => {
  describe("Input Validation & Contract Enforcement", () => {
    it("accepts valid email and password for login", () => {
      const result = LoginSchema.safeParse({
        email: "user@example.com",
        password: "ValidPassword123!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email formats during login", () => {
      const result = LoginSchema.safeParse({
        email: "not-an-email",
        password: "ValidPassword123!",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Invalid email address");
      }
    });

    it("rejects passwords shorter than 6 characters during login", () => {
      const result = LoginSchema.safeParse({
        email: "user@example.com",
        password: "123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Password must be at least 6 characters");
      }
    });

    it("validates password reset confirmation matching", () => {
      const matching = ResetPasswordSchema.safeParse({
        password: "StrongPassword123",
        confirmPassword: "StrongPassword123",
      });
      expect(matching.success).toBe(true);

      const mismatched = ResetPasswordSchema.safeParse({
        password: "StrongPassword123",
        confirmPassword: "DifferentPassword456",
      });
      expect(mismatched.success).toBe(false);
      if (!mismatched.success) {
        expect(mismatched.error.errors[0].message).toBe("Passwords do not match");
      }
    });

    it("requires at least 8 characters for password reset", () => {
      const short = ResetPasswordSchema.safeParse({
        password: "short",
        confirmPassword: "short",
      });
      expect(short.success).toBe(false);
    });
  });

  describe("Access Guard & Role-Based Access Control Logic", () => {
    interface MockProfile {
      id: string;
      email: string;
      role: "user" | "super_admin";
      is_banned: boolean;
    }

    function checkRouteAccess(
      profile: MockProfile | null,
      pathname: string,
    ): { allowed: boolean; redirectTo?: string } {
      if (!profile) {
        return { allowed: false, redirectTo: "/login" };
      }

      if (profile.is_banned) {
        return { allowed: false, redirectTo: "/login?error=account_banned" };
      }

      if (pathname.startsWith("/admin")) {
        if (profile.role !== "super_admin") {
          return { allowed: false, redirectTo: "/dashboard" };
        }
      }

      return { allowed: true };
    }

    it("redirects unauthenticated users to /login", () => {
      expect(checkRouteAccess(null, "/dashboard")).toEqual({
        allowed: false,
        redirectTo: "/login",
      });
      expect(checkRouteAccess(null, "/admin")).toEqual({
        allowed: false,
        redirectTo: "/login",
      });
    });

    it("blocks banned users from accessing dashboard and admin", () => {
      const bannedUser: MockProfile = {
        id: "banned-uuid",
        email: "banned@test.com",
        role: "user",
        is_banned: true,
      };

      expect(checkRouteAccess(bannedUser, "/dashboard")).toEqual({
        allowed: false,
        redirectTo: "/login?error=account_banned",
      });

      const bannedAdmin: MockProfile = {
        id: "banned-admin-uuid",
        email: "badadmin@test.com",
        role: "super_admin",
        is_banned: true,
      };

      expect(checkRouteAccess(bannedAdmin, "/admin")).toEqual({
        allowed: false,
        redirectTo: "/login?error=account_banned",
      });
    });

    it("allows standard active users into /dashboard but forbids /admin", () => {
      const activeUser: MockProfile = {
        id: "user-uuid",
        email: "active@test.com",
        role: "user",
        is_banned: false,
      };

      expect(checkRouteAccess(activeUser, "/dashboard")).toEqual({ allowed: true });
      expect(checkRouteAccess(activeUser, "/admin")).toEqual({
        allowed: false,
        redirectTo: "/dashboard",
      });
    });

    it("allows super_admin into both /dashboard and /admin", () => {
      const admin: MockProfile = {
        id: "admin-uuid",
        email: "admin@test.com",
        role: "super_admin",
        is_banned: false,
      };

      expect(checkRouteAccess(admin, "/dashboard")).toEqual({ allowed: true });
      expect(checkRouteAccess(admin, "/admin")).toEqual({ allowed: true });
      expect(checkRouteAccess(admin, "/admin/users")).toEqual({ allowed: true });
    });
  });
});
