import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "—";
  }
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${code} ${Math.round(Number(amount)).toLocaleString()}`;
  }
}

export function formatDateShort(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRelativeTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return "Pending first check";
  const time = new Date(isoTimestamp).getTime();
  if (Number.isNaN(time)) return "—";
  const diffMin = Math.round((Date.now() - time) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.round(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.round(diffHrs / 24)}d ago`;
}

/**
 * Returns the canonical base URL of the running application.
 * Automatically adapts across Vercel production/preview deployments, custom domains, and local dev.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

