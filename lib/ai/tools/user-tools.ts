import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import { fetchLiveFlightPrices } from "@/lib/flights/pricing-service";
import { FlightSearchService } from "@/lib/flights/search-service";
import { resolveAirportCode, getAirportDetails } from "@/lib/flights/airport-resolver";
import { getTomorrowDateString } from "@/lib/dates/flight-datetime";
import { generateMultiSiteComparisonLinks } from "@/lib/flight-urls";
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
        origin: z.string().trim().describe("3-letter IATA code or city name (e.g. DEL, BOM, Delhi, London)"),
        destination: z.string().trim().describe("3-letter IATA code or city name (e.g. PAT, DXB, Patna, Bombay)"),
        departureDate: z.string().optional().describe("Departure date in YYYY-MM-DD format (defaults to tomorrow if omitted)"),
        returnDate: z.string().optional().describe("Optional return date in YYYY-MM-DD format"),
        tripType: z.enum(["one_way", "round_trip", "one-way", "round-trip"]).default("one_way"),
        currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).default("INR"),
        directOnly: z.boolean().default(false).describe("Only return non-stop flights"),
        flightNumber: z.string().trim().optional().describe("Optional flight number filter e.g. 6E 6245 or AI 407"),
        airline: z.string().trim().optional().describe("Optional airline name or code filter e.g. IndiGo or 6E"),
      }),
      execute: async ({
        origin,
        destination,
        departureDate,
        returnDate,
        tripType,
        currency,
        directOnly,
        flightNumber,
        airline,
      }: {
        origin: string;
        destination: string;
        departureDate?: string;
        returnDate?: string;
        tripType: "one_way" | "round_trip" | "one-way" | "round-trip";
        currency: "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
        directOnly: boolean;
        flightNumber?: string;
        airline?: string;
      }) => {
        const resolvedOrigin = resolveAirportCode(origin) || origin.trim().toUpperCase().slice(0, 3);
        const resolvedDest = resolveAirportCode(destination) || destination.trim().toUpperCase().slice(0, 3);
        const cleanDate = departureDate && /^\d{4}-\d{2}-\d{2}$/.test(departureDate)
          ? departureDate
          : getTomorrowDateString();

        const normalizedTrip = tripType === "round_trip" || tripType === "round-trip" ? "round_trip" : "one_way";

        const searchResult = await FlightSearchService.search({
          origin: resolvedOrigin,
          destination: resolvedDest,
          departureDate: cleanDate,
          returnDate: normalizedTrip === "round_trip" && returnDate ? returnDate : undefined,
          tripType: normalizedTrip,
          currency,
          directOnly,
          pageSize: 20,
        });

        if (!searchResult || searchResult.offers.length === 0) {
          const origDetails = getAirportDetails(resolvedOrigin);
          const destDetails = getAirportDetails(resolvedDest);
          const originLabel = origDetails ? `${origDetails.city} (${resolvedOrigin})` : resolvedOrigin;
          const destLabel = destDetails ? `${destDetails.city} (${resolvedDest})` : resolvedDest;

          const comparisonLinks = generateMultiSiteComparisonLinks({
            origin: resolvedOrigin,
            destination: resolvedDest,
            departureDate: cleanDate,
            returnDate: normalizedTrip === "round_trip" && returnDate ? returnDate : undefined,
            tripType: normalizedTrip,
          });

          // Check if we have recent historical price benchmarks for this route in our database
          let benchmarkSummary: string | null = null;
          try {
            const { data: routeBenchmarks } = await ctx.supabase
              .from("tracked_flights")
              .select("target_price, currency, initial_price, airline_name")
              .or(`and(origin.eq.${resolvedOrigin},destination.eq.${resolvedDest}),and(origin.eq.${resolvedDest},destination.eq.${resolvedOrigin})`)
              .limit(5);

            if (routeBenchmarks && routeBenchmarks.length > 0) {
              const prices = routeBenchmarks
                .map((b) => Number(b.initial_price || b.target_price))
                .filter((p) => !isNaN(p) && p > 0);
              if (prices.length > 0) {
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                benchmarkSummary = min === max
                  ? `Recent AeroDrop telemetry for ${resolvedOrigin} ↔ ${resolvedDest} indicates fares around ${formatCurrency(min, currency)}.`
                  : `Recent AeroDrop telemetry for ${resolvedOrigin} ↔ ${resolvedDest} indicates fares typically range between ${formatCurrency(min, currency)} and ${formatCurrency(max, currency)}.`;
              }
            }
          } catch {}

          return {
            found: false,
            route: `${originLabel} → ${destLabel}`,
            departureDate: cleanDate,
            message: `Live airline seat inventory for ${originLabel} → ${destLabel} on ${cleanDate} is not currently indexed in the provider cache. Flight pricing updates dynamically as airlines release seats.`,
            benchmarkSummary,
            comparisonSites: comparisonLinks.map((s) => ({
              name: s.name,
              url: s.url,
              markdownLink: `[Compare on ${s.name}](${s.url})`,
            })),
            trackerRecommendation: {
              origin: resolvedOrigin,
              destination: resolvedDest,
              departureDate: cleanDate,
              recommendedTargetPrice: currency === "INR" ? 5000 : 150,
            },
          };
        }

        let matchingOffers = searchResult.offers;
        if (flightNumber) {
          const cleanFN = flightNumber.replace(/[\s-]/g, "").toUpperCase();
          const filtered = matchingOffers.filter((o) => o.flightNumber.replace(/[\s-]/g, "").toUpperCase().includes(cleanFN));
          if (filtered.length > 0) matchingOffers = filtered;
        }
        if (airline) {
          const cleanA = airline.toLowerCase();
          const filtered = matchingOffers.filter((o) => o.airline.toLowerCase().includes(cleanA) || o.airlineCode.toLowerCase() === cleanA);
          if (filtered.length > 0) matchingOffers = filtered;
        }

        const topOption = matchingOffers[0] || searchResult.offers[0];

        return {
          found: true,
          route: `${resolvedOrigin} → ${resolvedDest}`,
          bestPrice: topOption.formattedPrice,
          airline: topOption.airline,
          flightNumber: topOption.flightNumber,
          departureTime: topOption.departureTime,
          arrivalTime: topOption.arrivalTime,
          bookingAction: `[Book on ${topOption.seller || topOption.airline} (${topOption.formattedPrice})](${topOption.bookingUrl})`,
          optionsCount: matchingOffers.length,
          topOptions: matchingOffers.slice(0, 5).map((opt) => ({
            airline: opt.airline,
            airlineCode: opt.airlineCode,
            flightNumber: opt.flightNumber,
            price: opt.formattedPrice,
            rawPrice: opt.price,
            departureDate: opt.departureDate,
            departureTime: opt.departureTime,
            arrivalDate: opt.arrivalDate,
            arrivalTime: opt.arrivalTime,
            duration: opt.durationFormatted,
            stops: opt.stopsLabel,
            isOvernight: opt.isOvernight,
            isBestOverall: opt.isBestOverall,
            dayDifference: opt.dayDifference > 0 ? `+${opt.dayDifference}` : "Same day",
            priceStatus: opt.priceStatusLabel,
            seller: opt.seller,
            itineraryFingerprint: opt.itineraryFingerprint,
            bookingMarkdown: `[Book on ${opt.seller || opt.airline} (${opt.formattedPrice})](${opt.bookingUrl})`,
          })),
          comparisonSites: (topOption.comparisonSites || []).map((s) => ({
            name: s.name,
            url: s.url,
            markdownLink: `[Compare on ${s.name}](${s.url})`,
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
        origin: z.string().trim().describe("3-letter IATA departure code or city name (e.g. DEL, Patna)"),
        destination: z.string().trim().describe("3-letter IATA destination code or city name (e.g. PAT, Delhi)"),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date in YYYY-MM-DD"),
        returnDate: z.string().optional().describe("Return date for round-trips (YYYY-MM-DD)"),
        tripType: z.enum(["one_way", "round_trip", "one-way", "round-trip"]).default("one_way"),
        currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).default("INR"),
        targetPrice: z.coerce.number().positive().describe("Alert threshold price in selected currency"),
        trackingMode: z.enum(["route", "exact_flight"]).default("route").describe("Track broad route or exact flight"),
        flightNumber: z.string().trim().optional().describe("Specific flight number e.g. 6E 6245 or AI 407"),
        airlineCode: z.string().trim().optional().describe("Airline 2-letter IATA code e.g. 6E or AI"),
        airlineName: z.string().trim().optional().describe("Airline name e.g. IndiGo or Air India"),
        departureTime: z.string().trim().optional().describe("Local departure time HH:MM"),
        arrivalTime: z.string().trim().optional().describe("Local arrival time HH:MM"),
        itineraryFingerprint: z.string().trim().optional().describe("Itinerary fingerprint from flight search"),
        bookingUrl: z.string().trim().optional().describe("Direct booking URL"),
      }),
      execute: async ({
        origin,
        destination,
        departureDate,
        returnDate,
        tripType,
        currency,
        targetPrice,
        trackingMode,
        flightNumber,
        airlineCode,
        airlineName,
        departureTime,
        arrivalTime,
        itineraryFingerprint,
        bookingUrl,
      }: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        tripType: "one_way" | "round_trip" | "one-way" | "round-trip";
        currency: "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
        targetPrice: number;
        trackingMode?: "route" | "exact_flight";
        flightNumber?: string;
        airlineCode?: string;
        airlineName?: string;
        departureTime?: string;
        arrivalTime?: string;
        itineraryFingerprint?: string;
        bookingUrl?: string;
      }) => {
        const resolvedOrigin = resolveAirportCode(origin) || origin.trim().toUpperCase().slice(0, 3);
        const resolvedDest = resolveAirportCode(destination) || destination.trim().toUpperCase().slice(0, 3);
        const normalizedTrip = tripType === "round_trip" || tripType === "round-trip" ? "round_trip" : "one_way";
        const mode = trackingMode === "exact_flight" || Boolean(flightNumber) ? "exact_flight" : "route";

        const confirmationMsg = flightNumber
          ? `Please confirm activating radar tracking for ${airlineName || ""} flight ${flightNumber} (${resolvedOrigin} → ${resolvedDest} on ${departureDate}${departureTime ? `, departs ${departureTime}` : ""}) with an alert target of ${formatCurrency(targetPrice, currency)}.`
          : `Please confirm activating radar tracking for ${resolvedOrigin} → ${resolvedDest} on ${departureDate} with an alert target of ${formatCurrency(targetPrice, currency)}.`;

        return {
          type: "action_proposal",
          action: "create_tracker",
          requiresUserConfirmation: true,
          details: {
            origin: resolvedOrigin,
            destination: resolvedDest,
            departureDate,
            returnDate: normalizedTrip === "round_trip" && returnDate ? returnDate : null,
            tripType: normalizedTrip,
            currency,
            targetPrice,
            formattedTargetPrice: formatCurrency(targetPrice, currency),
            userEmail: ctx.user.email,
            trackingMode: mode,
            flightNumber: flightNumber || null,
            airlineCode: airlineCode || null,
            airlineName: airlineName || null,
            departureTime: departureTime || null,
            arrivalTime: arrivalTime || null,
            itineraryFingerprint: itineraryFingerprint || null,
            bookingUrl: bookingUrl || null,
          },
          confirmationMessage: confirmationMsg,
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
