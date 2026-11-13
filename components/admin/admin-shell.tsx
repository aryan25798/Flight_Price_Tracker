"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bell,
  ClipboardList,
  LogOut,
  Menu,
  Plane,
  Radio,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/dashboard/actions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface AdminShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AdminShell({ profile, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: Activity },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/trackers", label: "Global Trackers", icon: Plane },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardList },
    { href: "/admin/settings", label: "System Settings", icon: Settings },
  ];

  const getPageTitle = () => {
    if (pathname === "/admin") return "Admin Dashboard";
    if (pathname.startsWith("/admin/users")) return "User Management";
    if (pathname.startsWith("/admin/trackers")) return "Global Trackers";
    if (pathname.startsWith("/admin/audit-logs")) return "System Audit Logs";
    if (pathname.startsWith("/admin/settings")) return "Engine & Polling Config";
    return "Admin";
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5">
      <div className="space-y-7">
        {/* Brand Header */}
        <Link
          href="/admin"
          className="flex items-center gap-3 px-2 py-1 transition-all duration-200 hover:opacity-90 group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.35)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
              AeroDrop
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">
              Admin Console
            </span>
          </div>
        </Link>

        {/* Navigation Section */}
        <div className="space-y-1.5">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-widest uppercase text-[var(--muted-foreground)]/80">
            Administration
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 sm:text-sm",
                    active
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_16px_rgba(245,158,11,0.18)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] border border-transparent",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      active ? "text-amber-400" : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
                    )}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Return to Dashboard & Sign Out */}
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <Link href="/dashboard" className="block">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2.5 text-xs font-semibold text-sky-400 hover:text-sky-300 border-sky-500/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to User Dashboard</span>
          </Button>
        </Link>

        <form action={signOutAction}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-500/10 border border-transparent"
            type="submit"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex ambient-night-mesh selection:bg-amber-500/25">
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] glass-surface-1 md:block sticky top-0 h-screen z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] glass-floating border-r border-[var(--border-strong)] h-full flex flex-col slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3.5 top-4 rounded-xl p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)]"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Mobile/Desktop Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] glass-panel px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-semibold text-[var(--muted-foreground)]">
                Admin Console /
              </span>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-[var(--foreground)]">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <Badge variant="amber" dot className="hidden sm:inline-flex text-xs">
              Superuser Mode
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
