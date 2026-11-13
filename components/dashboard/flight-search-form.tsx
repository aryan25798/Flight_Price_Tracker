"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
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
import { formatCurrency, formatDateShort } from "@/lib/utils";
import {
  CABIN_CLASSES,
  CreateTrackerSchema,
  SUPPORTED_CURRENCIES,
  type CreateTrackerInput,
} from "@/lib/validations/tracker";
import { createTrackerAction } from "@/app/dashboard/actions";
import { checkCurrentPriceAction, type FlightPriceQuote } from "@/app/dashboard/price-action";
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
  const [quote, setQuote] = React.useState<FlightPriceQuote | null>(null);

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

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
  }, [origin, destination, departureDate, returnDate, tripType, currency, directOnly]);

  function handleSwapAirports() {
    const currentOrigin = origin;
    const currentDest = destination;
    setValue("origin", currentDest, { shouldValidate: true });
    setValue("destination", currentOrigin, { shouldValidate: true });
  }

  async function handleCheckPrice() {
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
    setQuote(null);
    try {
      const res = await checkCurrentPriceAction({
        origin,
        destination,
        departureDate,
        returnDate: tripType === "round_trip" ? returnDate : null,
        tripType,
        currency,
        directOnly,
      });

      setQuote(res);

      if (res.found && res.bestPrice) {
        toast.success(`Found ${res.options?.length || 1} fare(s) from ${formatCurrency(res.bestPrice, currency)}`);
        const suggested = Math.max(1, Math.round(res.bestPrice * 0.95));
        setValue("targetPrice", suggested, { shouldValidate: true });
      } else {
        toast.info(res.message || "No cached flights found for this date. You can still set your target price!");
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
      reset({
        ...values,
        origin: "",
        destination: "",
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
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                <Plane className="h-4 w-4 rotate-45" />
              </span>
              <CardTitle className="text-base sm:text-lg font-extrabold tracking-tight">
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
              onClick={handleCheckPrice}
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

          {/* Live Airline Fare Comparison Results Drawer */}
          {quote && (
            <div className="rounded-2xl border border-sky-500/30 glass-surface-2 p-4 sm:p-5 text-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--foreground)]">
                      Live Fares Found ({quote.options?.length || 0} Seller Options)
                    </h4>
                    {quote.message && (
                      <p className="text-xs text-[var(--muted-foreground)]">{quote.message}</p>
                    )}
                  </div>
                </div>

                {quote.bestPrice && (
                  <Badge variant="success" dot className="text-xs">
                    Lowest: {formatCurrency(quote.bestPrice, quote.currency || currency)}
                  </Badge>
                )}
              </div>

              {quote.options && quote.options.length > 0 ? (
                <div className="grid gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {quote.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--border)] glass-surface-3 p-3.5 hover:border-sky-500/40 hover:shadow-xs transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[var(--foreground)]">{opt.airline}</span>
                          {opt.flightNumber && (
                            <span className="font-mono text-xs text-[var(--muted-foreground)]">
                              #{opt.flightNumber}
                            </span>
                          )}
                          <Badge variant={opt.isDirect ? "success" : "secondary"}>
                            {opt.isDirect ? "Non-Stop" : `${opt.transfers} stop(s)`}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
                          <span>Departs: <strong className="text-[var(--foreground)]">{formatDateShort(opt.departureAt)}</strong></span>
                          <span className="flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            Provider: <strong className="text-[var(--foreground)]">{opt.seller}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-bold tabular-nums text-sky-400">
                            {formatCurrency(opt.price, opt.currency)}
                          </span>
                        </div>
                        <a
                          href={opt.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl btn-glass-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                        >
                          <span>Book</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {quote.message || "No cached flights found for this date. You can still set your target price to monitor!"}
                </p>
              )}

              {/* Multi-Site Comparison Row */}
              {quote.comparisonSites && quote.comparisonSites.length > 0 && (
                <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-sky-400" />
                      Compare Live Rates Across Top Travel Sites
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      Instant 1-click comparison
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {quote.comparisonSites.map((site) => (
                      <a
                        key={site.id}
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] glass-surface-3 hover:border-sky-500/50 hover:shadow-xs transition-all text-xs group"
                      >
                        <div className="truncate">
                          <span className="font-bold text-[var(--foreground)] block truncate">
                            {site.name}
                          </span>
                          <span className="text-[10px] text-[var(--muted-foreground)] block truncate">
                            {site.tag}
                          </span>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)] group-hover:text-sky-400 shrink-0 ml-1.5 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
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
                  : "Activate Route Tracker"}
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
