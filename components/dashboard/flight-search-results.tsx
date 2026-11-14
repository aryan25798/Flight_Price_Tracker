"use client";

import * as React from "react";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Clock,
  Compass,
  ExternalLink,
  Filter,
  Info,
  Luggage,
  Moon,
  Percent,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunset,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { AirlineLogo } from "@/components/ui/airline-logo";
import { formatCurrency, cn } from "@/lib/utils";
import type { NormalizedFlightOffer, SearchResultSnapshot, FlightSearchQuery } from "@/lib/flights/search-service";
import type { SupportedCurrency } from "@/types/database";

export interface FlightSearchResultsProps {
  results: SearchResultSnapshot | null;
  loading: boolean;
  currency: SupportedCurrency;
  onSelectExactFlight: (offer: NormalizedFlightOffer) => void;
  onFilterChange: (filters: FlightSearchQuery["filters"]) => void;
  onSortChange: (sortBy: FlightSearchQuery["sortBy"]) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  activeSort: FlightSearchQuery["sortBy"];
  activeFilters?: FlightSearchQuery["filters"];
}

// Airline branding color accent generator
function getAirlineBadgeStyle(code: string): { bg: string; text: string; border: string } {
  const upper = code.toUpperCase();
  if (upper === "6E") {
    // IndiGo
    return { bg: "bg-blue-600/15", text: "text-blue-300", border: "border-blue-500/30" };
  }
  if (upper === "AI") {
    // Air India
    return { bg: "bg-red-600/15", text: "text-red-300", border: "border-red-500/30" };
  }
  if (upper === "UK") {
    // Vistara
    return { bg: "bg-purple-600/15", text: "text-purple-300", border: "border-purple-500/30" };
  }
  if (upper === "SG") {
    // SpiceJet
    return { bg: "bg-orange-600/15", text: "text-orange-300", border: "border-orange-500/30" };
  }
  if (upper === "QP") {
    // Akasa Air
    return { bg: "bg-amber-600/15", text: "text-amber-300", border: "border-amber-500/30" };
  }
  if (upper === "EK") {
    // Emirates
    return { bg: "bg-red-700/15", text: "text-red-300", border: "border-red-600/30" };
  }
  if (upper === "SQ") {
    // Singapore Airlines
    return { bg: "bg-yellow-600/15", text: "text-yellow-300", border: "border-yellow-500/30" };
  }
  if (upper === "BA") {
    // British Airways
    return { bg: "bg-sky-600/15", text: "text-sky-300", border: "border-sky-500/30" };
  }
  return { bg: "bg-slate-800", text: "text-slate-200", border: "border-slate-700" };
}

export function FlightSearchResults({
  results,
  loading,
  currency,
  onSelectExactFlight,
  onFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  activeSort = "cheapest",
  activeFilters,
}: FlightSearchResultsProps) {
  const [showFiltersDrawer, setShowFiltersDrawer] = React.useState(false);
  const [expandedOffers, setExpandedOffers] = React.useState<Record<string, boolean>>({});

  // Loading skeleton state
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] glass-surface-2 p-4 sm:p-6 space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>

        <div className="grid gap-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] glass-surface-3 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="flex items-center gap-4 py-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-1 flex-1" />
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const {
    offers,
    totalOffers,
    filteredCount,
    page,
    pageSize,
    availableAirlines,
    minPrice,
    maxPrice,
    query,
    priceReliability,
  } = results;

  const hasActiveFilters =
    Boolean(activeFilters?.stops?.length) ||
    Boolean(activeFilters?.airlines?.length) ||
    Boolean(activeFilters?.depTimeSlot?.length) ||
    Boolean(activeFilters?.maxPrice && activeFilters.maxPrice < maxPrice);

  function handleToggleStop(stopCount: number) {
    const current = activeFilters?.stops || [];
    const next = current.includes(stopCount)
      ? current.filter((s) => s !== stopCount)
      : [...current, stopCount];
    onFilterChange({ ...activeFilters, stops: next.length > 0 ? next : undefined });
  }

  function handleToggleAirline(code: string) {
    const current = activeFilters?.airlines || [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    onFilterChange({ ...activeFilters, airlines: next.length > 0 ? next : undefined });
  }

  function handleToggleTimeSlot(slot: "morning" | "afternoon" | "evening" | "night") {
    const current = activeFilters?.depTimeSlot || [];
    const next = current.includes(slot)
      ? current.filter((s) => s !== slot)
      : [...current, slot];
    onFilterChange({ ...activeFilters, depTimeSlot: next.length > 0 ? next : undefined });
  }

  function handleClearFilters() {
    onFilterChange({});
  }

  return (
    <div className="rounded-2xl border border-sky-500/30 glass-surface-2 p-4 sm:p-6 text-sm space-y-5 shadow-xl animate-in fade-in duration-200">
      {/* 1. Discovery Results Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-600/20 text-sky-400 border border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-[var(--foreground)] tracking-tight">
                {query.origin} → {query.destination}
              </h3>
              <Badge variant="cyan" className="text-[10px] font-mono">
                {query.tripType === "round_trip" ? "Round-Trip" : "One-Way"}
              </Badge>
              <span className="text-xs text-[var(--muted-foreground)]">·</span>
              <span className="text-xs font-semibold text-slate-300">{query.departureDate}</span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Found <strong className="text-sky-300 font-semibold">{totalOffers} distinct offers</strong> across verified flight inventories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("aerodrop:open-copilot", {
                  detail: {
                    prompt: `Evaluate live flight offers for ${query.origin} → ${query.destination} on ${query.departureDate}. We found ${totalOffers} airline options starting from ${formatCurrency(minPrice, currency)}. Are these prices competitive, and which specific departure is best?`,
                  },
                })
              );
            }}
            className="rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold text-xs shadow-xs"
            title="Ask AI Copilot to evaluate these offers"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-400 mr-1.5" />
            <span>Copilot Evaluation</span>
          </Button>

          <Button
            type="button"
            variant={showFiltersDrawer ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
            className="rounded-xl border border-[var(--border)] font-semibold text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            <span>Filters {hasActiveFilters ? "●" : ""}</span>
          </Button>
        </div>
      </div>

      {/* Price Reliability Status Notice */}
      {priceReliability && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-950/30 p-2.5 text-xs text-slate-300">
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-sky-300">
              {priceReliability.status === "CACHED_PRICE" ? "Indexed Market Snapshot" : "Live Pricing Engine"}
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">{priceReliability.notice}</p>
          </div>
        </div>
      )}

      {/* 2. Interactive Filters Bar (Expandable on demand or desktop persistent) */}
      {showFiltersDrawer && (
        <div className="rounded-xl border border-[var(--border)] glass-surface-3 p-3.5 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-sky-400" />
              <span>Refine Flight Options</span>
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Filter 1: Stops */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Flight Stops</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 0, label: "Non-stop" },
                  { value: 1, label: "1 Stop" },
                  { value: 2, label: "2+ Stops" },
                ].map((s) => {
                  const active = activeFilters?.stops?.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleToggleStop(s.value)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer",
                        active
                          ? "bg-sky-500/20 text-sky-300 border-sky-400/40 font-bold shadow-xs"
                          : "glass-surface-2 text-slate-400 border-[var(--border)] hover:text-white"
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter 2: Airlines */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Airlines</span>
              <div className="flex flex-wrap gap-1.5">
                {availableAirlines.map((airline) => {
                  const active = activeFilters?.airlines?.includes(airline.code);
                  return (
                    <button
                      key={airline.code}
                      type="button"
                      onClick={() => handleToggleAirline(airline.code)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                        active
                          ? "bg-sky-500/20 text-sky-300 border-sky-400/40 font-bold shadow-xs"
                          : "glass-surface-2 text-slate-400 border-[var(--border)] hover:text-white"
                      )}
                    >
                      <AirlineLogo code={airline.code} name={airline.name} size="xs" />
                      <span>{airline.name}</span>
                      <span className="text-[10px] text-sky-400 font-mono">
                        {formatCurrency(airline.minPrice, currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter 3: Departure Times */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Departure Time</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { slot: "morning" as const, label: "Morning", sub: "06:00 - 12:00", icon: Sun },
                  { slot: "afternoon" as const, label: "Afternoon", sub: "12:00 - 18:00", icon: Sun },
                  { slot: "evening" as const, label: "Evening", sub: "18:00 - 24:00", icon: Sunset },
                  { slot: "night" as const, label: "Night", sub: "00:00 - 06:00", icon: Moon },
                ].map((t) => {
                  const active = activeFilters?.depTimeSlot?.includes(t.slot);
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.slot}
                      type="button"
                      onClick={() => handleToggleTimeSlot(t.slot)}
                      className={cn(
                        "p-1.5 rounded-lg text-left text-xs border transition-all cursor-pointer flex items-center gap-1.5",
                        active
                          ? "bg-sky-500/20 text-sky-300 border-sky-400/40 font-bold shadow-xs"
                          : "glass-surface-2 text-slate-400 border-[var(--border)] hover:text-white"
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0 text-sky-400" />
                      <div className="leading-tight">
                        <p className="font-semibold text-[11px]">{t.label}</p>
                        <p className="text-[9px] text-slate-500">{t.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sorting Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: "best" as const, label: "Best Overall", icon: Sparkles, desc: "Value" },
            { id: "cheapest" as const, label: "Cheapest", icon: Zap, desc: "Lowest fare" },
            { id: "fastest" as const, label: "Fastest", icon: Clock, desc: "Shortest travel" },
            { id: "earliest_dep" as const, label: "Earliest Dep", icon: PlaneTakeoff, desc: "Early start" },
            { id: "latest_arr" as const, label: "Latest Arr", icon: PlaneLanding, desc: "Evening reach" },
          ].map((tab) => {
            const active = activeSort === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSortChange(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs",
                  active
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs"
                    : "glass-surface-2 text-slate-400 border-[var(--border)] hover:text-white hover:border-slate-700"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active ? "text-sky-400" : "text-slate-500")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-[var(--muted-foreground)] font-medium">
          Showing <strong className="text-[var(--foreground)]">{offers.length}</strong> of {filteredCount} offers
        </span>
      </div>

      {/* 4. Flight Cards List (Skyscanner / MakeMyTrip-grade layout) */}
      {offers.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] glass-surface-3 p-8 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mx-auto">
            <Compass className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-sm text-[var(--foreground)]">No flights match your filters</h4>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
            Try loosening your filters or resetting your airline, stops, and time slot preferences.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="rounded-xl border-[var(--border)] text-xs"
          >
            Reset All Filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {offers.map((offer) => {
            const airlineBadge = getAirlineBadgeStyle(offer.airlineCode);
            return (
              <div
                key={offer.id}
                className={cn(
                  "relative rounded-2xl border transition-all overflow-hidden p-4 sm:p-5 glass-surface-3 space-y-4 hover:border-sky-500/40 hover:shadow-lg group",
                  offer.isBestOverall ? "border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]" : "border-[var(--border)]"
                )}
              >
                {/* Top Badge Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {offer.isBestOverall && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        <span>Best Overall Deal</span>
                      </span>
                    )}

                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      {offer.priceStatusLabel}
                    </span>

                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Luggage className="h-3 w-3 text-slate-500" />
                      <span>{offer.baggageAllowance}</span>
                    </span>

                    {offer.aircraft && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        <Plane className="h-2.5 w-2.5 text-sky-400" />
                        <span>{offer.aircraft}</span>
                      </span>
                    )}

                    {offer.distanceKm && (
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                        {offer.distanceKm.toLocaleString()} km
                      </span>
                    )}

                    {offer.codeshares && offer.codeshares.length > 0 && (
                      <span className="text-[10px] text-purple-300/80 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full hidden md:inline-block">
                        Codeshare: {offer.codeshares.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium">
                    Seller: <strong className="text-slate-200">{offer.seller}</strong>
                  </span>
                </div>

                {/* Main Flight Timeline Row */}
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px] items-center gap-4 py-1">
                  {/* Airline & Flight Identity */}
                  <div className="flex items-center gap-3">
                    <AirlineLogo
                      code={offer.airlineCode}
                      name={offer.airline}
                      logoUrl={offer.airlineLogo}
                      size="md"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-extrabold text-sm text-[var(--foreground)] truncate">
                        {offer.airline}
                      </p>
                      <p className="font-mono text-xs text-sky-400 font-semibold">
                        {offer.flightNumber}
                      </p>
                      <p className="text-[10px] text-slate-400 capitalize">
                        {offer.cabinClass.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  {/* Flight Timeline & Schedule */}
                  <div className="flex items-center justify-between gap-3 px-2 sm:px-6">
                    {/* Departure Node */}
                    <div className="text-left space-y-0.5">
                      <span className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                        {offer.departureTime}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-sky-400">{offer.originAirport}</p>
                        {offer.terminal && (
                          <span className="text-[9px] font-extrabold bg-sky-950/60 text-sky-300 border border-sky-400/30 px-1 py-0.2 rounded leading-tight shadow-xs">
                            {offer.terminal.replace(/terminal\s*/i, "T")}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-[80px]">
                        {offer.originCity}
                      </p>
                    </div>

                    {/* Progress Path */}
                    <div className="flex-1 flex flex-col items-center px-3 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {offer.durationFormatted}
                      </span>
                      <div className="relative w-full flex items-center">
                        <div className="h-0.5 w-full bg-slate-700/80 rounded-full" />
                        <div className="absolute inset-x-0 flex justify-center">
                          <Plane className="h-3.5 w-3.5 text-sky-400 rotate-90 bg-[#0d1527] px-0.5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={offer.stops === 0 ? "success" : "secondary"}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {offer.stopsLabel}
                        </Badge>
                        {offer.isOvernight && (
                          <span className="text-[9px] font-bold px-1.5 py-0 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            +{offer.dayDifference} Day
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrival Node */}
                    <div className="text-right space-y-0.5">
                      <span className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                        {offer.arrivalTime}
                      </span>
                      <div className="flex items-center justify-end gap-1.5">
                        {offer.arrivalTerminal && (
                          <span className="text-[9px] font-extrabold bg-sky-950/60 text-sky-300 border border-sky-400/30 px-1 py-0.2 rounded leading-tight shadow-xs">
                            {offer.arrivalTerminal.replace(/terminal\s*/i, "T")}
                          </span>
                        )}
                        <p className="text-xs font-bold text-sky-400">{offer.destinationAirport}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-[80px]">
                        {offer.destinationCity}
                      </p>
                    </div>
                  </div>

                  {/* Price & Action Section */}
                  <div className="flex flex-col items-end justify-center space-y-2 border-t md:border-t-0 md:border-l border-[var(--border)] pt-3 md:pt-0 md:pl-4">
                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {offer.formattedPrice}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {formatCurrency(offer.pricePerAdult, offer.currency)} / adult
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        onClick={() => onSelectExactFlight(offer)}
                        className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex-1 sm:flex-initial"
                      >
                        <Bell className="h-3.5 w-3.5 mr-1" />
                        <span>Track This Flight</span>
                      </Button>

                      {offer.bookingUrl && (
                        <a
                          href={offer.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-sky-400/30 glass-surface-2 text-sky-300 hover:text-white hover:bg-sky-500/20 transition-all"
                          title="Open direct provider booking offer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connecting Segments Breakdown Accordion */}
                {offer.segments && offer.segments.length > 1 && (
                  <div className="pt-2 border-t border-[var(--border)]/40">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOffers((prev) => ({ ...prev, [offer.id]: !prev[offer.id] }))
                      }
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <AirlineLogo code={offer.segments[0].airlineCode} size="xs" />
                      <span>
                        {expandedOffers[offer.id]
                          ? "Hide connecting flight breakdown"
                          : `View detailed flight breakdown (${offer.stopsLabel} via ${offer.segments[0].destination})`}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          expandedOffers[offer.id] && "rotate-180"
                        )}
                      />
                    </button>

                    {expandedOffers[offer.id] && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-950/40 border border-[var(--border)] space-y-2 text-xs">
                        {offer.segments.map((seg, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2 last:border-b-0 last:pb-0"
                          >
                            <div className="flex items-center gap-2">
                              <AirlineLogo
                                code={seg.airlineCode}
                                name={seg.airline}
                                logoUrl={seg.airlineLogo}
                                size="xs"
                              />
                              <div>
                                <p className="font-semibold text-white">
                                  {seg.airline} · {seg.flightNumber}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {seg.origin} ({seg.departureTime})
                                  {seg.terminal ? ` [${seg.terminal}]` : ""} →{" "}
                                  {seg.destination} ({seg.arrivalTime})
                                  {seg.arrivalTerminal ? ` [${seg.arrivalTerminal}]` : ""}
                                  {seg.aircraft ? ` · ${seg.aircraft}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {seg.durationFormatted}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Verified Comparison Portals Pill Strip */}
                <div className="border-t border-[var(--border)]/70 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Compare live fares on partner portals:</span>
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {offer.comparisonSites.map((site) => (
                      <a
                        key={site.name}
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-sky-500/25 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 hover:text-white font-medium text-[11px] transition-all no-underline shadow-2xs"
                      >
                        <span>{site.name}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Pagination Bar (10, 20, 50 offers per page) */}
      {filteredCount > pageSize && (
        <div className="pt-2 border-t border-[var(--border)]">
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={filteredCount}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            itemLabel="flight offers"
          />
        </div>
      )}
    </div>
  );
}
