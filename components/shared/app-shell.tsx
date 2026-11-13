"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  History,
  LayoutDashboard,
  LineChart,
  ListFilter,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAutoHideHeader } from "@/hooks/use-auto-hide-header";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
  unreadNotificationCount?: number;
}

export function AppShell({
  profile,
  children,
  unreadNotificationCount = 0,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { isCollapsed, toggleSidebar } = useSidebarState();
  const isHeaderVisible = useAutoHideHeader({ disabled: mobileOpen });

  // Close mobile drawer on path change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape key press
  React.useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Lock body scroll when mobile drawer is open
  React.useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileOpen]);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/trackers", label: "Track Flights", icon: Plane },
    {
      href: "/dashboard/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
    },
    { href: "/dashboard/settings", label: "Telegram Alerts", icon: Radio },
  ];

  if (profile.role === "super_admin") {
    navItems.push({ href: "/admin", label: "Admin Panel", icon: Shield });
  }

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Flight Command Center";
    if (pathname.startsWith("/dashboard/trackers")) return "Active Flight Trackers";
    if (pathname.startsWith("/dashboard/notifications")) return "Notification Center";
    if (pathname.startsWith("/dashboard/settings")) return "Alerts & Configuration";
    if (pathname.startsWith("/admin")) return "Superuser Console";
    return "AeroDrop";
  };

  const displayName = profile.email?.split("@")[0] || "Traveler";

  return (
    <div className="min-h-screen flex ambient-night-mesh selection:bg-sky-500/25">
      {/* Desktop Sticky Sidebar with Collapse/Expand Mode */}
      <aside
        className={cn(
          "hidden md:flex flex-col justify-between border-r border-[var(--border)] glass-surface-1 sticky top-0 h-screen z-20 transition-all duration-300 ease-in-out shrink-0",
          isCollapsed ? "w-20 p-3" : "w-64 p-4 sm:p-5",
        )}
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 transition-all duration-200 hover:opacity-90 group overflow-hidden",
                isCollapsed && "justify-center w-full",
              )}
              title="AeroDrop Flight Radar"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] transition-all">
                <Plane className="h-5 w-5 rotate-45 transform" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col animate-in fade-in duration-200">
                  <span className="text-base font-extrabold tracking-tight text-[var(--foreground)] leading-tight">
                    AeroDrop
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-sky-400">
                    Flight Radar
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Section */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <p className="px-3 pb-2 text-[10px] font-bold tracking-widest uppercase text-[var(--muted-foreground)]/80 animate-in fade-in duration-200">
                Navigation
              </p>
            )}
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
                    prefetch={true}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center rounded-xl text-xs font-semibold transition-all duration-200 sm:text-sm",
                      isCollapsed
                        ? "justify-center h-11 w-11 mx-auto p-0"
                        : "gap-3.5 px-3.5 py-2.5",
                      active
                        ? "bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-[0_0_16px_rgba(56,189,248,0.18)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] border border-transparent",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-sky-400"
                          : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
                      )}
                    />
                    {!isCollapsed && <span>{item.label}</span>}

                    {item.badge && (
                      <span
                        className={cn(
                          "rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-bold text-red-300",
                          isCollapsed
                            ? "absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center px-1"
                            : "ml-auto px-1.5 py-0.2",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {active && !item.badge && (
                      <span
                        className={cn(
                          "rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]",
                          isCollapsed
                            ? "absolute bottom-1 h-1 w-1"
                            : "absolute right-3 h-1.5 w-1.5",
                        )}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Profile & Sidebar Collapse Toggle */}
        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          {/* User Card */}
          <div
            className={cn(
              "flex items-center rounded-xl glass-surface-2 border border-[var(--border)] transition-all",
              isCollapsed ? "justify-center p-2" : "gap-3 p-2.5",
            )}
            title={profile.email}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-700 text-xs font-bold text-white shadow-xs">
              {profile.email?.charAt(0).toUpperCase() || "U"}
            </div>
            {!isCollapsed && (
              <div className="flex min-w-0 flex-1 flex-col animate-in fade-in duration-200">
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
            )}
          </div>

          {/* Sign Out Action */}
          <form action={signOutAction}>
            <button
              type="submit"
              className={cn(
                "flex items-center rounded-xl text-xs font-semibold text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-500/10 transition-colors w-full cursor-pointer",
                isCollapsed
                  ? "justify-center h-10 w-10 mx-auto"
                  : "gap-2.5 px-3 py-2",
              )}
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>
          </form>

          {/* Desktop Collapse/Expand Control */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              "flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--glass-surface-2)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--glass-surface-3)] transition-all w-full py-1.5 text-xs font-semibold cursor-pointer",
              isCollapsed ? "h-9 w-9 mx-auto p-0" : "gap-2 px-3",
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="text-[11px]">Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] glass-floating border-r border-[var(--border)] h-full flex flex-col justify-between p-5 slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)]">
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

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)]"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Links */}
              <nav className="space-y-1.5 pt-2">
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
                      prefetch={true}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all min-h-[44px]",
                        active
                          ? "bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-[0_0_16px_rgba(56,189,248,0.18)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)]",
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <Icon className={cn("h-4 w-4", active ? "text-sky-400" : "")} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-xs font-bold text-red-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer */}
            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-3 border border-[var(--border)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-700 text-xs font-bold text-white">
                  {profile.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-xs font-bold text-[var(--foreground)]">
                    {profile.email}
                  </p>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {profile.role === "super_admin" ? "Super Admin" : "Active Member"}
                  </span>
                </div>
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 w-full py-2.5 transition-colors min-h-[44px]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Intelligent Auto-Hiding Header */}
        <header
          className={cn(
            "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] glass-panel px-4 backdrop-blur-xl sm:px-6 lg:px-8 transition-transform duration-300 ease-in-out",
            isHeaderVisible ? "translate-y-0" : "-translate-y-full",
          )}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Hamburger Button with 44px touch target */}
            <button
              type="button"
              className="flex md:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--foreground)] hover:bg-[var(--glass-surface-3)] focus:outline-hidden focus:ring-2 focus:ring-sky-400/50 cursor-pointer"
              onClick={() => setMobileOpen(true)}
              aria-label="Open mobile navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="hidden sm:inline-block text-xs font-semibold text-[var(--muted-foreground)]">
                Dashboard /
              </span>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-[var(--foreground)] truncate max-w-[180px] sm:max-w-none">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick status pill */}
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--glass-surface-2)] px-3 py-1 text-[11px] font-semibold text-sky-300 shadow-2xs backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>Cron: Active (4h)</span>
            </div>

            {/* In-App Notification Bell & Interactive Dropdown */}
            <NotificationBell initialUnreadCount={unreadNotificationCount} />

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
