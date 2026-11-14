"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Compass,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Percent,
  Plane,
  Plus,
  Search,
  Sparkles,
  Store,
  Tag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AirportAutocomplete } from "@/components/airports/airport-autocomplete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import {
  getTodayDateString,
  getTomorrowDateString,
  addDaysToDateOnly,
  formatCalendarDate,
  calculateFlightTimeline,
} from "@/lib/dates/flight-datetime";
import {
  CABIN_CLASSES,
  CreateTrackerSchema,
  SUPPORTED_CURRENCIES,
  type CreateTrackerInput,
} from "@/lib/validations/tracker";
import { createTrackerAction } from "@/app/dashboard/actions";
import { checkCurrentPriceAction, type FlightPriceQuote } from "@/app/dashboard/price-action";
import { FlightSearchResults } from "@/components/dashboard/flight-search-results";
import type { SearchResultSnapshot, NormalizedFlightOffer, FlightSearchQuery } from "@/lib/flights/search-service";
import { cn } from "@/lib/utils";
import type { UserQuota } from "@/types/database";

export function FlightSearchForm({
  initialOrigin,
  initialDestination,
  quotaInfo,
}: {
  initialOrigin?: string;
  initialDestination?: string;
  quotaInfo?: UserQuota;
} = {}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [checkingPrice, setCheckingPrice] = React.useState(false);
  const [directOnly, setDirectOnly] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResultSnapshot | null>(null);
  const [activeSort, setActiveSort] = React.useState<FlightSearchQuery["sortBy"]>("cheapest");
  const [activeFilters, setActiveFilters] = React.useState<FlightSearchQuery["filters"]>({});
  const [currentPage, setCurrentPage] = React.useState(1);
  const [currentPageSize, setCurrentPageSize] = React.useState(10);
  const [selectedOffer, setSelectedOffer] = React.useState<NormalizedFlightOffer | null>(null);
  const [quote, setQuote] = React.useState<FlightPriceQuote | null>(null);
  const [optionsPage, setOptionsPage] = React.useState(1);
  const [optionsSort, setOptionsSort] = React.useState<"price" | "direct" | "airline">("price");
  const OPTIONS_PAGE_SIZE = 5;

  React.useEffect(() => {
    setOptionsPage(1);
  }, [quote]);

  const sortedOptions = React.useMemo(() => {
    if (!quote?.options) return [];
    return [...quote.options].sort((a, b) => {
      if (optionsSort === "price") return a.price - b.price;
      if (optionsSort === "direct") {
        if (a.isDirect && !b.isDirect) return -1;
        if (!a.isDirect && b.isDirect) return 1;
        return a.price - b.price;
      }
      return a.airline.localeCompare(b.airline);
    });
  }, [quote?.options, optionsSort]);

  const pagedOptions = React.useMemo(() => {
    const start = (optionsPage - 1) * OPTIONS_PAGE_SIZE;
    return sortedOptions.slice(start, start + OPTIONS_PAGE_SIZE);
  }, [sortedOptions, optionsPage]);

  const today = React.useMemo(() => getTodayDateString(), []);

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTrackerInput>({
    resolver: zodResolver(CreateTrackerSchema),
    defaultValues: {
      origin: initialOrigin?.toUpperCase() || "",
      destination: initialDestination?.toUpperCase() || "",
      departureDate: "",
      returnDate: "",
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 5000,
      trackingMode: "route",
    },
  });

  const origin = watch("origin");
  const destination = watch("destination");
  const departureDate = watch("departureDate");
  const returnDate = watch("returnDate");
  const tripType = watch("tripType");
  const currency = watch("currency");
  const targetPrice = watch("targetPrice");

  React.useEffect(() => {
    setQuote(null);
    setSearchResults(null);
    setSelectedOffer(null);
  }, [origin, destination, departureDate, returnDate, tripType, currency, directOnly]);

  function handleSwapAirports() {
    const currentOrigin = origin;
    const currentDest = destination;
    setValue("origin", currentDest, { shouldValidate: true });
    setValue("destination", currentOrigin, { shouldValidate: true });
  }

  async function handleCheckPrice(overrideParams?: Partial<FlightSearchQuery>) {
    if (!origin || origin.length !== 3) {
      toast.error("Please select an origin airport");
      return;
    }
    if (!destination || destination.length !== 3) {
      toast.error("Please select a destination airport");
      return;
    }
    if (origin === destination) {
      toast.error("Origin and destination must be different");
      return;
    }
    if (!departureDate) {
      toast.error("Please choose a departure date");
      return;
    }
    if (tripType === "round_trip" && (!returnDate || returnDate < departureDate)) {
      toast.error("Please select a return date on or after departure date");
      return;
    }

    setCheckingPrice(true);
    try {
      const pageToUse = overrideParams?.page ?? currentPage;
      const pageSizeToUse = overrideParams?.pageSize ?? currentPageSize;
      const sortToUse = overrideParams?.sortBy ?? activeSort;
      const filtersToUse = overrideParams?.filters ?? activeFilters;

      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          departureDate,
          returnDate: tripType === "round_trip" ? returnDate : null,
          tripType,
          adults: watch("adults") || 1,
          children: watch("children") || 0,
          infants: watch("infants") || 0,
          cabinClass: watch("cabinClass") || "economy",
          currency,
          directOnly,
          page: pageToUse,
          pageSize: pageSizeToUse,
          sortBy: sortToUse,
          filters: filtersToUse,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch flight search results");
      }

      const data: SearchResultSnapshot = await res.json();
      setSearchResults(data);

      if (data.totalOffers > 0 && data.offers.length > 0) {
        toast.success(`Found ${data.totalOffers} distinct flight offer(s) from ${formatCurrency(data.minPrice, currency)}`);
        if (!selectedOffer && data.minPrice > 0) {
          const suggested = Math.max(1, Math.round(data.minPrice * 0.95));
          setValue("targetPrice", suggested, { shouldValidate: true });
        }
      } else {
        toast.info(data.priceReliability?.notice || "No cached flights found for this date. You can still set your target price!");
      }
    } catch {
      toast.error("Failed to check current prices");
    } finally {
      setCheckingPrice(false);
    }
  }

  async function onSubmit(values: CreateTrackerInput) {
    setSubmitting(true);
    try {
      const result = await createTrackerAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setQuote(null);
      setSearchResults(null);
      setSelectedOffer(null);
      reset({
        ...values,
        origin: "",
        destination: "",
        flightNumber: "",
        airlineCode: "",
        airlineName: "",
        departureTime: "",
        arrivalTime: "",
        itineraryFingerprint: "",
        bookingUrl: "",
        trackingMode: "route",
      });
    } catch {
      toast.error("Unexpected error creating tracker");
    } finally {
      setSubmitting(false);
    }
  }

  const canCheckPrice =
    origin.length === 3 &&
    destination.length === 3 &&
    origin !== destination &&
    Boolean(departureDate);

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-xl overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] glass-surface-2/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Compass className="h-4 w-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
                Track Your Next Flight
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Get notified when prices drop for your favorite routes. Scans multi-airline inventory and compares 6 top booking sites.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {quotaInfo && (
              <div className="flex items-center gap-2">
                {quotaInfo.is_unlimited ? (
                  <Badge variant="cyan" dot className="text-xs font-semibold capitalize border-cyan-500/30">
                    {quotaInfo.tier} · Unlimited Trackers (∞)
                  </Badge>
                ) : (
                  <Badge
                    variant={quotaInfo.remaining === 0 ? "destructive" : "secondary"}
                    className="text-xs font-mono"
                  >
                    {quotaInfo.current_count} / {quotaInfo.effective_limit} Trackers ({quotaInfo.remaining} left)
                  </Badge>
                )}
              </div>
            )}

            {/* Trip Type Segmented Controller */}
            <div className="inline-flex self-start sm:self-auto rounded-xl border border-[var(--border)] glass-surface-2 p-1">
            <button
              type="button"
              onClick={() => setValue("tripType", "one_way", { shouldValidate: true })}
              className={cn(
                "rounded-lg px-3.5 py-1 text-xs font-bold transition-all cursor-pointer",
                tripType === "one_way"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent",
              )}
            >
              One-way
            </button>
            <button
              type="button"
              onClick={() => setValue("tripType", "round_trip", { shouldValidate: true })}
              className={cn(
                "rounded-lg px-3.5 py-1 text-xs font-bold transition-all cursor-pointer",
                tripType === "round_trip"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent",
              )}
            >
              Round-trip
            </button>
          </div>
        </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Origin & Destination Bar with Interactive Swap */}
          <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-4">
            <Controller
              name="origin"
              control={control}
              render={({ field }) => (
                <AirportAutocomplete
                  id="origin-airport"
                  label="From (Origin)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.origin?.message}
                />
              )}
            />

            <div className="flex justify-center md:pb-1">
              <button
                type="button"
                onClick={handleSwapAirports}
                className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[var(--border)] glass-surface-2 text-[var(--muted-foreground)] hover:border-sky-500/40 hover:text-sky-400 hover:bg-sky-500/10 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Swap Origin and Destination"
                aria-label="Swap Origin and Destination"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </button>
            </div>

            <Controller
              name="destination"
              control={control}
              render={({ field }) => (
                <AirportAutocomplete
                  id="destination-airport"
                  label="To (Destination)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.destination?.message}
                />
              )}
            />
          </div>

          {/* Dates & Preferences Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="space-y-1.5">
              <label htmlFor="departureDate" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Departure Date
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="departureDate"
                  type="date"
                  min={today}
                  className="pl-10 text-sm"
                  {...register("departureDate")}
                />
              </div>
              {errors.departureDate && (
                <p className="text-xs text-red-400 font-medium">{errors.departureDate.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="returnDate" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Return Date {tripType === "one_way" && "(N/A)"}
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="returnDate"
                  type="date"
                  min={departureDate || today}
                  disabled={tripType === "one_way"}
                  className="pl-10 text-sm disabled:opacity-40"
                  {...register("returnDate")}
                />
              </div>
              {errors.returnDate && (
                <p className="text-xs text-red-400 font-medium">{errors.returnDate.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cabinClass" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Cabin Class
              </label>
              <select
                id="cabinClass"
                {...register("cabinClass")}
                className="flex min-h-[42px] sm:min-h-[40px] w-full rounded-xl border border-[var(--border)] bg-[var(--glass-surface-2)] px-3 text-sm text-[var(--foreground)] backdrop-blur-md shadow-inner transition-all hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
              >
                {CABIN_CLASSES.map((c) => (
                  <option key={c} value={c} className="bg-[var(--card)] text-[var(--foreground)]">
                    {c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="currency" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Alert Currency
              </label>
              <select
                id="currency"
                {...register("currency")}
                className="flex min-h-[42px] sm:min-h-[40px] w-full rounded-xl border border-[var(--border)] bg-[var(--glass-surface-2)] px-3 text-sm text-[var(--foreground)] backdrop-blur-md shadow-inner transition-all hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((cur) => (
                  <option key={cur} value={cur} className="bg-[var(--card)] text-[var(--foreground)]">
                    {cur} ({cur === "INR" ? "₹" : cur === "USD" ? "$" : cur === "EUR" ? "€" : cur})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Passenger Count & Stops Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] glass-surface-2 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-400" />
                <span className="font-bold text-xs text-[var(--muted-foreground)] uppercase">Passengers:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="adults" className="text-xs font-semibold">Adults</label>
                <input
                  id="adults"
                  type="number"
                  min={1}
                  max={9}
                  className="w-12 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 text-center font-mono text-sm font-bold"
                  {...register("adults")}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="children" className="text-xs font-semibold">Children</label>
                <input
                  id="children"
                  type="number"
                  min={0}
                  max={8}
                  className="w-12 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 text-center font-mono text-sm font-bold"
                  {...register("children")}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="infants" className="text-xs font-semibold">Infants</label>
                <input
                  id="infants"
                  type="number"
                  min={0}
                  max={9}
                  className="w-12 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 text-center font-mono text-sm font-bold"
                  {...register("infants")}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--muted-foreground)] cursor-pointer select-none flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={directOnly}
                  onChange={(e) => setDirectOnly(e.target.checked)}
                  className="rounded border-[var(--border)] text-sky-500 focus:ring-sky-500 h-4 w-4 cursor-pointer"
                />
                <span>Direct flights only</span>
              </label>
            </div>
          </div>

          {/* Action Row: Check Price vs Save Tracker */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={!canCheckPrice || checkingPrice}
              onClick={() => handleCheckPrice()}
              className="gap-2 text-xs sm:text-sm font-bold min-h-[42px]"
            >
              {checkingPrice ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              ) : (
                <Search className="h-4 w-4 text-sky-400" />
              )}
              <span>Check Current Airline Fares</span>
            </Button>

            {quote?.bestPrice && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">Suggested Alert:</span>
                <button
                  type="button"
                  onClick={() => {
                    const discount = Math.round(quote.bestPrice! * 0.95);
                    setValue("targetPrice", discount, { shouldValidate: true });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer transition-all shadow-2xs"
                >
                  <Percent className="h-3 w-3" />
                  <span>5% below ({formatCurrency(Math.round(quote.bestPrice * 0.95), currency)})</span>
                </button>
              </div>
            )}
          </div>

          {/* Phase 5 Premium Flight Search & Comparison Engine Results */}
          {(searchResults || checkingPrice) && (
            <FlightSearchResults
              results={searchResults}
              loading={checkingPrice}
              currency={currency}
              onSelectExactFlight={(offer) => {
                setSelectedOffer(offer);
                setValue("trackingMode", "exact_flight");
                setValue("flightNumber", offer.flightNumber);
                setValue("airlineCode", offer.airlineCode);
                setValue("airlineName", offer.airline);
                setValue("departureTime", offer.departureTime);
                setValue("arrivalTime", offer.arrivalTime);
                setValue("itineraryFingerprint", offer.itineraryFingerprint);
                setValue("bookingUrl", offer.bookingUrl || "");
                const discounted = Math.max(1, Math.round(offer.price * 0.95));
                setValue("targetPrice", discounted, { shouldValidate: true });
                toast.success(
                  `Selected ${offer.airline} #${offer.flightNumber} (${offer.departureTime} departure). Target price set to ${formatCurrency(discounted, currency)}.`
                );
              }}
              onSortChange={(newSort) => {
                setActiveSort(newSort);
                handleCheckPrice({ sortBy: newSort, page: 1 });
              }}
              onFilterChange={(newFilters) => {
                setActiveFilters(newFilters);
                handleCheckPrice({ filters: newFilters, page: 1 });
              }}
              onPageChange={(newPage) => {
                setCurrentPage(newPage);
                handleCheckPrice({ page: newPage });
              }}
              onPageSizeChange={(newSize) => {
                setCurrentPageSize(newSize);
                setCurrentPage(1);
                handleCheckPrice({ pageSize: newSize, page: 1 });
              }}
              activeSort={activeSort}
              activeFilters={activeFilters}
            />
          )}

          {/* Exact Flight Selected Confirmation Banner */}
          {selectedOffer && (
            <div className="rounded-2xl border border-sky-500/40 bg-sky-950/40 p-3.5 text-xs flex items-center justify-between gap-3 animate-in fade-in shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  <Plane className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 truncate">
                  <p className="font-extrabold text-white truncate">
                    Tracking Exact Flight: {selectedOffer.airline} {selectedOffer.flightNumber}
                  </p>
                  <p className="text-[11px] text-slate-300 truncate">
                    Departs {selectedOffer.departureTime} ({selectedOffer.originAirport}) → Arrives {selectedOffer.arrivalTime} ({selectedOffer.destinationAirport}) · {selectedOffer.formattedPrice}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedOffer(null);
                  setValue("trackingMode", "route");
                  setValue("flightNumber", "");
                  setValue("airlineCode", "");
                  setValue("airlineName", "");
                  setValue("departureTime", "");
                  setValue("arrivalTime", "");
                  setValue("itineraryFingerprint", "");
                  setValue("bookingUrl", "");
                }}
                className="text-slate-400 hover:text-white text-[11px] h-8 shrink-0 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Quota Limit Warning Banner */}
          {quotaInfo && !quotaInfo.is_unlimited && quotaInfo.remaining === 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300">Active Tracker Quota Reached:</strong> You have reached your limit of {quotaInfo.effective_limit} active trackers on the {quotaInfo.tier.toUpperCase()} tier. To track additional routes, pause one of your existing trackers or contact an administrator for a Pro or Enterprise plan upgrade.
              </div>
            </div>
          )}

          {/* Target Price & Create Submission */}
          <div className="border-t border-[var(--border)] pt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="w-full sm:max-w-xs space-y-1.5">
              <label htmlFor="targetPrice" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Target Alert Price ({currency})
              </label>
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  id="targetPrice"
                  type="number"
                  step="1"
                  min={1}
                  className="pl-10 font-mono text-base font-bold tabular-nums"
                  {...register("targetPrice")}
                />
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                You will be notified on Telegram the instant fares drop below this price.
              </p>
              {errors.targetPrice && (
                <p className="text-xs text-red-400 font-medium">{errors.targetPrice.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting || (Boolean(quotaInfo) && !quotaInfo?.is_unlimited && quotaInfo?.remaining === 0)}
              className="gap-2 min-h-[46px] px-7 text-sm font-bold shadow-lg cursor-pointer self-stretch sm:self-auto"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>
                {Boolean(quotaInfo) && !quotaInfo?.is_unlimited && quotaInfo?.remaining === 0
                  ? `Quota Reached (${quotaInfo?.effective_limit}/${quotaInfo?.effective_limit})`
                  : selectedOffer
                  ? `Activate Radar for ${selectedOffer.airline} #${selectedOffer.flightNumber}`
                  : "Activate Route Tracker"}
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
