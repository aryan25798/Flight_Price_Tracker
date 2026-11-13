"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Compass,
  History,
  LayoutDashboard,
  LineChart,
  ListFilter,
  LogOut,
  Menu,
  Plane,
  Radio,
  Search,
  Settings,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/dashboard/actions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close drawer on path change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
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
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/trackers", label: "Track Flights", icon: Plane },
    { href: "/dashboard/settings", label: "Telegram Alerts", icon: Radio },
  ];

  if (profile.role === "super_admin") {
    navItems.push({ href: "/admin", label: "Admin Panel", icon: Shield });
  }

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Flight Command Center";
    if (pathname.startsWith("/dashboard/trackers")) return "Active Flight Trackers";
    if (pathname.startsWith("/dashboard/settings")) return "Alerts & Configuration";
    if (pathname.startsWith("/admin")) return "Superuser Console";
    return "AeroDrop";
  };

  const displayName = profile.email?.split("@")[0] || "Traveler";

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5">
      <div className="space-y-7">
        {/* Brand Header */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-2 py-1 transition-all duration-200 hover:opacity-90 group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] transition-all">
            <Plane className="h-5 w-5 rotate-45 transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
              AeroDrop
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-sky-400">
              Flight Radar
            </span>
          </div>
        </Link>

        {/* Navigation Section */}
        <div className="space-y-1.5">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-widest uppercase text-[var(--muted-foreground)]/80">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 sm:text-sm",
                    active
                      ? "bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-[0_0_16px_rgba(56,189,248,0.18)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] border border-transparent",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      active ? "text-sky-400" : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
                    )}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile & Footer */}
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-700 text-xs font-bold text-white shadow-xs">
            {profile.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-xs font-bold text-[var(--foreground)]">
              {profile.email}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">
                {profile.role === "super_admin" ? "Super Admin" : "Active Member"}
              </span>
            </div>
          </div>
        </div>

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
    <div className="min-h-screen flex ambient-night-mesh selection:bg-sky-500/25">
      {/* Desktop Sticky Sidebar with Luxury Frosted Glass */}
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
        {/* Sticky Mobile/Desktop Glass Header */}
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
                Dashboard /
              </span>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-[var(--foreground)]">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Quick status pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--glass-surface-2)] px-3 py-1 text-[11px] font-semibold text-sky-300 shadow-2xs backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>Cron: Active (4h)</span>
            </div>

            <Link href="/dashboard/settings" title="Alert Notifications">
              <Button variant="ghost" size="iconSm" className="rounded-xl text-[var(--muted-foreground)] hover:text-white">
                <Bell className="h-4 w-4" />
              </Button>
            </Link>

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
