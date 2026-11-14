import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import { checkCurrentPriceAction } from "@/app/dashboard/price-action";
import { formatCurrency } from "@/lib/utils";

export interface UserToolContext {
  user: { id: string; email?: string };
  profile: Profile;
  supabase: SupabaseClient;
}

export function buildUserTools(ctx: UserToolContext) {
  return {
    get_my_trackers: tool({
      description: "Retrieve all active and paused flight price trackers configured by the authenticated user.",
      inputSchema: z.object({
        status: z.enum(["all", "active", "paused"]).default("all").describe("Filter trackers by status"),
      }),
      execute: async ({ status }: { status: "all" | "active" | "paused" }) => {
        let query = ctx.supabase
          .from("tracked_flights")
          .select(`
            id,
            origin,
            destination,
            departure_date,
            return_date,
            trip_type,
            cabin_class,
            currency,
            target_price,
            last_seen_price,
            last_notified_price,
            is_active,
            updated_at
          `)
          .eq("user_id", ctx.user.id)
          .order("created_at", { ascending: false });

        if (status === "active") query = query.eq("is_active", true);
        if (status === "paused") query = query.eq("is_active", false);

        const { data, error } = await query;
        if (error) return { error: "Failed to retrieve flight trackers from database" };

        return {
          total: data?.length ?? 0,
          trackers: (data ?? []).map((t) => ({
            id: t.id,
            route: `${t.origin} → ${t.destination}`,
            origin: t.origin,
            destination: t.destination,
            departureDate: t.departure_date,
            returnDate: t.return_date,
            tripType: t.trip_type,
            cabinClass: t.cabin_class,
            targetPrice: `${t.currency} ${Number(t.target_price).toLocaleString()}`,
            currentPrice: t.last_seen_price
              ? `${t.currency} ${Number(t.last_seen_price).toLocaleString()}`
              : "Checking in next cycle",
            status: t.is_active ? "active" : "paused",
            targetMet: t.last_seen_price ? t.last_seen_price <= t.target_price : false,
          })),
        };
      },
    }),

    search_flights: tool({
      description: "Query real-time live airline fares and booking links for a specific origin, destination, and departure date.",
      inputSchema: z.object({
        origin: z.string().trim().length(3).transform((s) => s.toUpperCase()).describe("3-letter IATA code of departure airport (e.g. DEL, BOM, LHR)"),
        destination: z.string().trim().length(3).transform((s) => s.toUpperCase()).describe("3-letter IATA code of arrival airport (e.g. SIN, DXB, JFK)"),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date in YYYY-MM-DD format"),
        returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional return date in YYYY-MM-DD format"),
        tripType: z.enum(["one_way", "round_trip"]).default("one_way"),
        currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).default("INR"),
        directOnly: z.boolean().default(false).describe("Only return non-stop flights"),
      }),
      execute: async ({
        origin,
        destination,
        departureDate,
        returnDate,
        tripType,
        currency,
        directOnly,
      }: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        tripType: "one_way" | "round_trip";
        currency: "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
        directOnly: boolean;
      }) => {
        const quote = await checkCurrentPriceAction({
          origin,
          destination,
          departureDate,
          returnDate: tripType === "round_trip" ? returnDate : undefined,
          tripType,
          currency,
          directOnly,
        });

        if (!quote) {
          return {
            found: false,
            message: `No live airfares found for ${origin} → ${destination} on ${departureDate}.`,
          };
        }

        const topOption = quote.options?.[0];

        return {
          found: true,
          bestPrice: quote.bestPrice ? formatCurrency(quote.bestPrice, quote.currency || currency) : null,
          airline: topOption?.airline || "Available Airlines",
          bookingUrl: topOption?.bookingUrl || null,
          optionsCount: quote.options?.length ?? 0,
          topOptions: (quote.options ?? []).slice(0, 3).map((opt) => ({
            airline: opt.airline,
            price: formatCurrency(opt.price, opt.currency),
            isDirect: opt.isDirect,
            flightNumber: opt.flightNumber,
            seller: opt.seller,
            bookingUrl: opt.bookingUrl,
          })),
          comparisonSites: quote.comparisonSites?.map((s) => ({
            name: s.name,
            url: s.url,
          })),
        };
      },
    }),

    get_my_price_history: tool({
      description: "Retrieve historical fare observations and price changes for a specific tracker owned by the user.",
      inputSchema: z.object({
        trackerId: z.string().uuid().describe("Unique identifier of the tracker"),
      }),
      execute: async ({ trackerId }: { trackerId: string }) => {
        const { data: tracker, error: trackerErr } = await ctx.supabase
          .from("tracked_flights")
          .select("id, route_id, origin, destination, currency, target_price, departure_date")
          .eq("id", trackerId)
          .eq("user_id", ctx.user.id)
          .single();

        if (trackerErr || !tracker) {
          return { error: "Tracker not found or not owned by authenticated user." };
        }

        const { data: history, error: histErr } = await ctx.supabase
          .from("price_history")
          .select("price, currency, airline, checked_at, booking_url")
          .eq("route_id", tracker.route_id)
          .order("checked_at", { ascending: false })
          .limit(20);

        if (histErr) return { error: "Failed to load price history points." };

        const points = (history ?? []).map((h) => ({
          price: h.price,
          formatted: formatCurrency(h.price, h.currency),
          airline: h.airline || "Unknown",
          date: h.checked_at,
        }));

        const prices = points.map((p) => p.price);
        const minPrice = prices.length ? Math.min(...prices) : null;
        const maxPrice = prices.length ? Math.max(...prices) : null;
        const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

        return {
          route: `${tracker.origin} → ${tracker.destination}`,
          departureDate: tracker.departure_date,
          targetPrice: formatCurrency(tracker.target_price, tracker.currency),
          totalObservations: points.length,
          lowestObserved: minPrice ? formatCurrency(minPrice, tracker.currency) : null,
          highestObserved: maxPrice ? formatCurrency(maxPrice, tracker.currency) : null,
          averageObserved: avgPrice ? formatCurrency(avgPrice, tracker.currency) : null,
          recentPoints: points.slice(0, 5),
        };
      },
    }),

    calculate_my_savings: tool({
      description: "Calculate verified historical savings achieved across all active price drops compared to original observed prices.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: trackers, error } = await ctx.supabase
          .from("tracked_flights")
          .select("id, origin, destination, currency, target_price, last_seen_price")
          .eq("user_id", ctx.user.id);

        if (error || !trackers) return { error: "Unable to calculate savings at this time." };

        let totalTargetSavings = 0;
        const deals: { route: string; target: string; current: string; saved: string }[] = [];

        for (const t of trackers) {
          if (t.last_seen_price && t.last_seen_price <= t.target_price) {
            const saved = t.target_price - t.last_seen_price;
            totalTargetSavings += saved;
            deals.push({
              route: `${t.origin} → ${t.destination}`,
              target: formatCurrency(t.target_price, t.currency),
              current: formatCurrency(t.last_seen_price, t.currency),
              saved: formatCurrency(saved, t.currency),
            });
          }
        }

        return {
          qualifyingDealsCount: deals.length,
          totalTrackersAudited: trackers.length,
          dealsBelowTarget: deals,
          summaryMessage: deals.length > 0
            ? `You currently have ${deals.length} flight(s) pricing below your target alert thresholds!`
            : "All your active trackers are currently above target thresholds. AeroDrop radar monitors them every 4 hours.",
        };
      },
    }),

    create_tracker: tool({
      description: "Propose creating a new automated flight price tracker. Always presents a confirmation proposal to the user before mutating database.",
      inputSchema: z.object({
        origin: z.string().trim().length(3).transform((s) => s.toUpperCase()).describe("3-letter IATA departure code"),
        destination: z.string().trim().length(3).transform((s) => s.toUpperCase()).describe("3-letter IATA destination code"),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date in YYYY-MM-DD"),
        returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Return date for round-trips"),
        tripType: z.enum(["one_way", "round_trip"]).default("one_way"),
        currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).default("INR"),
        targetPrice: z.number().positive().describe("Alert threshold price in selected currency"),
      }),
      execute: async ({
        origin,
        destination,
        departureDate,
        returnDate,
        tripType,
        currency,
        targetPrice,
      }: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        tripType: "one_way" | "round_trip";
        currency: "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
        targetPrice: number;
      }) => {
        return {
          type: "action_proposal",
          action: "create_tracker",
          requiresUserConfirmation: true,
          details: {
            origin,
            destination,
            departureDate,
            returnDate: tripType === "round_trip" ? returnDate : null,
            tripType,
            currency,
            targetPrice,
            formattedTargetPrice: formatCurrency(targetPrice, currency),
            userEmail: ctx.user.email,
          },
          confirmationMessage: `Please confirm activating radar tracking for ${origin} → ${destination} on ${departureDate} with an alert target of ${formatCurrency(targetPrice, currency)}.`,
        };
      },
    }),

    delete_tracker: tool({
      description: "Propose permanently deleting a tracker. Always returns a confirmation proposal before deletion.",
      inputSchema: z.object({
        trackerId: z.string().uuid().describe("ID of the tracker to delete"),
      }),
      execute: async ({ trackerId }: { trackerId: string }) => {
        const { data: tracker } = await ctx.supabase
          .from("tracked_flights")
          .select("id, origin, destination, departure_date, currency, target_price")
          .eq("id", trackerId)
          .eq("user_id", ctx.user.id)
          .single();

        if (!tracker) return { error: "Tracker not found or not owned by you." };

        return {
          type: "action_proposal",
          action: "delete_tracker",
          requiresUserConfirmation: true,
          trackerId: tracker.id,
          details: {
            route: `${tracker.origin} → ${tracker.destination}`,
            departureDate: tracker.departure_date,
            targetPrice: formatCurrency(tracker.target_price, tracker.currency),
          },
          confirmationMessage: `Are you sure you want to permanently delete your tracker for ${tracker.origin} → ${tracker.destination} (${tracker.departure_date})?`,
        };
      },
    }),

    pause_tracker: tool({
      description: "Pause automated 4-hour background monitoring for a flight tracker.",
      inputSchema: z.object({
        trackerId: z.string().uuid(),
      }),
      execute: async ({ trackerId }: { trackerId: string }) => {
        const { error } = await ctx.supabase
          .from("tracked_flights")
          .update({ is_active: false })
          .eq("id", trackerId)
          .eq("user_id", ctx.user.id);

        if (error) return { ok: false, error: "Failed to pause tracker." };
        return { ok: true, message: "Tracker successfully paused." };
      },
    }),

    resume_tracker: tool({
      description: "Resume automated 4-hour background monitoring for a flight tracker.",
      inputSchema: z.object({
        trackerId: z.string().uuid(),
      }),
      execute: async ({ trackerId }: { trackerId: string }) => {
        const { error } = await ctx.supabase
          .from("tracked_flights")
          .update({ is_active: true })
          .eq("id", trackerId)
          .eq("user_id", ctx.user.id);

        if (error) return { ok: false, error: "Failed to resume tracker." };
        return { ok: true, message: "Tracker successfully resumed." };
      },
    }),

    get_telegram_status: tool({
      description: "Check if the user's account is linked to the instant Telegram price alert bot.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          isLinked: Boolean(ctx.profile.telegram_chat_id),
          chatId: ctx.profile.telegram_chat_id ? `Linked (ID: ${ctx.profile.telegram_chat_id})` : "Not Linked",
          botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "MyFlightDropBot",
        };
      },
    }),
  };
}
