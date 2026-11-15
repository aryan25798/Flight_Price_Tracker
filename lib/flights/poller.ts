import { createAdminClient } from "@/lib/supabase/server";
import { FlightSearchService } from "@/lib/flights/search-service";
import {
  buildPriceDropEmail,
  buildRoutineStatusUpdateEmail,
  sendEmail,
} from "@/lib/email/smtp";
import { sendTelegramAlert } from "@/lib/telegram/server";
import { sendPushToUser } from "@/lib/push/server";
import { formatCurrency } from "@/lib/utils";

export interface PollRouteResult {
  ok: boolean;
  routeId: string;
  routeKey: string;
  price?: number;
  airline?: string;
  bookingUrl?: string | null;
  notificationsSent: number;
  error?: string;
}

export interface PollCycleResult {
  ok: boolean;
  runId?: string;
  claimed: number;
  succeeded: number;
  failed: number;
  notificationsSent: number;
  details: PollRouteResult[];
  error?: string;
}

/**
 * Polls a single monitored route using live search engines (SerpApi Google Flights + OAG + Travelpayouts).
 * Updates monitored_routes, tracked_flights, and price_history.
 * Dispatches Telegram, Email, and Push notifications when price alert criteria are met.
 */
export async function pollSingleRoute(
  routeId: string,
  options?: { forceAlerts?: boolean }
): Promise<PollRouteResult> {
  const supabase = createAdminClient();

  const { data: route, error: fetchErr } = await supabase
    .from("monitored_routes")
    .select("*")
    .eq("id", routeId)
    .single();

  if (fetchErr || !route) {
    return {
      ok: false,
      routeId,
      routeKey: "",
      notificationsSent: 0,
      error: fetchErr?.message || "Route not found",
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  // Schedule next check for 3h 50m to guarantee alignment with 4-hour cron cycles
  const nextCheckIso = new Date(now.getTime() + (3 * 60 + 50) * 60 * 1000).toISOString();

  const sp = (route.search_parameters as Record<string, unknown> | null) || {};
  const origin = (sp.origin as string) || route.origin;
  const destination = (sp.destination as string) || route.destination;
  const departureDate = (sp.departure_date as string) || route.departure_date;
  const returnDate = (sp.return_date as string) || route.return_date || undefined;
  const tripType =
    (sp.trip_type as "one_way" | "round_trip") ||
    (route.return_date ? "round_trip" : "one_way");
  const currency = (sp.currency as string) || "INR";
  const adults = Number(sp.adults) || 1;
  const cabinClass = (sp.cabin_class as "economy" | "premium_economy" | "business" | "first") || "economy";

  try {
    const searchSnapshot = await FlightSearchService.search({
      origin,
      destination,
      departureDate,
      returnDate: returnDate || null,
      tripType,
      adults,
      cabinClass,
      currency: currency as any,
      pageSize: 50,
      sortBy: "cheapest",
    });

    const offers = searchSnapshot.offers || [];

    if (offers.length === 0) {
      // No offers found on this run - record inspection attempt so next_check_at increments
      await supabase
        .from("monitored_routes")
        .update({
          last_checked_at: nowIso,
          next_check_at: nextCheckIso,
          failure_count: (route.failure_count || 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", route.id);

      return {
        ok: false,
        routeId: route.id,
        routeKey: route.route_key,
        notificationsSent: 0,
        error: "No flight offers returned across search providers",
      };
    }

    // Lowest overall fare on route across all providers
    const bestOffer = offers[0];
    const bestPrice = bestOffer.price;
    const airline = bestOffer.airlineCode || bestOffer.airline;
    const bookingUrl = bestOffer.bookingUrl || null;
    const provider = bestOffer.provider || "google_flights";

    // 1. Update monitored_routes table
    await supabase
      .from("monitored_routes")
      .update({
        last_price: bestPrice,
        last_airline: airline,
        last_booking_url: bookingUrl,
        provider,
        status: "active",
        last_checked_at: nowIso,
        next_check_at: nextCheckIso,
        failure_count: 0,
        updated_at: nowIso,
      })
      .eq("id", route.id);

    // 2. Insert into price_history
    await supabase.from("price_history").insert({
      route_id: route.id,
      route_key: route.route_key,
      price: bestPrice,
      currency: bestOffer.currency || currency,
      airline,
      booking_url: bookingUrl,
      provider,
      checked_at: nowIso,
    });

    // 3. Update tracked_flights for this route
    // Update route-level trackers to best overall price
    await supabase
      .from("tracked_flights")
      .update({
        last_seen_price: bestPrice,
        updated_at: nowIso,
      })
      .eq("route_id", route.id)
      .eq("is_active", true)
      .eq("tracking_mode", "route");

    // Also update exact-flight trackers with either their specific flight price or best price
    const { data: exactTrackers } = await supabase
      .from("tracked_flights")
      .select("id, flight_number")
      .eq("route_id", route.id)
      .eq("is_active", true)
      .eq("tracking_mode", "exact_flight");

    if (exactTrackers && exactTrackers.length > 0) {
      for (const et of exactTrackers) {
        const normalizedTargetNum = et.flight_number?.replace(/\s+/g, "").toUpperCase();
        const matched = offers.find(
          (o) => o.flightNumber?.replace(/\s+/g, "").toUpperCase() === normalizedTargetNum
        );
        const resolvedPrice = matched ? matched.price : bestPrice;
        await supabase
          .from("tracked_flights")
          .update({
            last_seen_price: resolvedPrice,
            updated_at: nowIso,
          })
          .eq("id", et.id);
      }
    }

    // 4. Evaluate notification alerts for all active subscribers on this route
    const { data: subscribers } = await supabase
      .from("tracked_flights")
      .select(`
        id, user_id, origin, destination, departure_date, return_date,
        currency, target_price, last_seen_price, last_notified_price, last_notified_at,
        flight_number, airline_name, tracking_mode,
        profiles!inner(id, is_banned, telegram_chat_id, email)
      `)
      .eq("route_id", route.id)
      .eq("is_active", true)
      .eq("profiles.is_banned", false);

    let notificationsSent = 0;
    const forceAlerts = Boolean(options?.forceAlerts);

    for (const tracker of subscribers || []) {
      const profile = Array.isArray(tracker.profiles) ? tracker.profiles[0] : tracker.profiles;
      if (!profile) continue;

      const userEmail = profile.email;
      const telegramChatId = profile.telegram_chat_id;
      const targetPrice = Number(tracker.target_price);
      const currentPrice = Number(tracker.last_seen_price || bestPrice);

      const lastNotifiedPrice =
        tracker.last_notified_price !== null ? Number(tracker.last_notified_price) : null;
      const lastNotifiedMs = tracker.last_notified_at
        ? new Date(tracker.last_notified_at).getTime()
        : 0;
      const hoursSinceAlert = tracker.last_notified_at
        ? (now.getTime() - lastNotifiedMs) / (1000 * 60 * 60)
        : 9999;

      // Condition A: Urgent Price Drop (price dropped below target alert or dropped further)
      const isPriceDrop = currentPrice <= targetPrice;

      if (isPriceDrop) {
        // Did price drop lower than last notification, or has cooldown elapsed, or forced by admin?
        const shouldAlertDrop =
          forceAlerts ||
          lastNotifiedPrice === null ||
          currentPrice < lastNotifiedPrice ||
          hoursSinceAlert >= 4;

        if (shouldAlertDrop) {
          notificationsSent++;

          // 1. Send Telegram Alert
          if (telegramChatId) {
            const savings = Math.max(0, targetPrice - currentPrice);
            const tgMsg = [
              "🚨 <b>PRICE DROP ALERT: FARE DROPPED!</b>",
              "",
              `Route: <b>${tracker.origin} → ${tracker.destination}</b>`,
              `Departure: <b>${tracker.departure_date}</b>`,
              tracker.flight_number ? `Flight: <b>${tracker.flight_number}</b>` : "",
              `Current Lowest Fare: <b>${tracker.currency} ${formatCurrency(currentPrice, tracker.currency)}</b>`,
              `Your Alert Target: <b>${tracker.currency} ${formatCurrency(targetPrice, tracker.currency)}</b>`,
              savings > 0
                ? `You Save: <b>${tracker.currency} ${formatCurrency(savings, tracker.currency)}</b>`
                : "",
              "",
              "⚡ <i>Hurry! Fares fluctuate constantly. Open AeroDrop dashboard to view booking portals.</i>",
            ]
              .filter(Boolean)
              .join("\n");

            sendTelegramAlert({ chatId: telegramChatId, text: tgMsg }).catch(() => {});
          }

          // 2. Send Email Alert
          if (userEmail) {
            sendEmail({
              to: userEmail,
              subject: `🚨 Price Drop Alert: ${tracker.origin} → ${tracker.destination} (${tracker.currency} ${currentPrice})`,
              html: buildPriceDropEmail({
                origin: tracker.origin,
                destination: tracker.destination,
                departureDate: tracker.departure_date,
                currentPrice,
                targetPrice,
                currency: tracker.currency,
                airline,
                bookingUrl: bookingUrl || undefined,
              }),
            }).catch(() => {});
          }

          // 3. Send Native Browser Push Alert
          sendPushToUser(tracker.user_id, {
            title: `🚨 Price Drop: ${tracker.origin} → ${tracker.destination}`,
            body: `Now ${tracker.currency} ${Number(currentPrice).toLocaleString()} (Target: ${tracker.currency} ${Number(targetPrice).toLocaleString()}). Tap to book!`,
            url: "/dashboard",
          }).catch(() => {});

          // Record in-app notification
          await supabase.from("notification_logs").insert({
            user_id: tracker.user_id,
            tracker_id: tracker.id,
            route_id: route.id,
            notification_type: "price_drop",
            previous_price: lastNotifiedPrice,
            current_price: currentPrice,
            currency: tracker.currency,
            delivery_status: "sent",
            idempotency_key: crypto.randomUUID(),
            sent_at: nowIso,
            is_read: false,
          });

          // Update tracker notification state
          await supabase
            .from("tracked_flights")
            .update({
              last_notified_price: currentPrice,
              last_notified_at: nowIso,
            })
            .eq("id", tracker.id);
        }
      } else {
        // Condition B: Routine 4-Hour Radar Update (fare is still above target, keeping user updated)
        const isRoutineDue =
          forceAlerts ||
          !tracker.last_notified_at ||
          hoursSinceAlert >= 3.5;

        if (isRoutineDue) {
          notificationsSent++;

          // 1. Send Telegram Alert
          if (telegramChatId) {
            const diff = currentPrice - targetPrice;
            const tgMsg = [
              "⏱️ <b>4-HOUR RADAR SCAN UPDATE</b>",
              "",
              `Route: <b>${tracker.origin} → ${tracker.destination}</b>`,
              `Departure: <b>${tracker.departure_date}</b>`,
              `Current Rate: <b>${tracker.currency} ${formatCurrency(currentPrice, tracker.currency)}</b> (${airline})`,
              `Your Target: <b>${tracker.currency} ${formatCurrency(targetPrice, tracker.currency)}</b> (+${tracker.currency} ${formatCurrency(diff, tracker.currency)})`,
              "",
              "AeroDrop scanned 100+ airline catalogs in this 4-hour cycle. We will alert you immediately once fares drop below your target!",
            ].join("\n");

            sendTelegramAlert({ chatId: telegramChatId, text: tgMsg }).catch(() => {});
          }

          // 2. Send Email Alert
          if (userEmail) {
            sendEmail({
              to: userEmail,
              subject: `⏱️ 4-Hour Flight Status: ${tracker.origin} → ${tracker.destination}`,
              html: buildRoutineStatusUpdateEmail({
                origin: tracker.origin,
                destination: tracker.destination,
                departureDate: tracker.departure_date,
                currentPrice,
                targetPrice,
                currency: tracker.currency,
                airline,
                bookingUrl: bookingUrl || undefined,
              }),
            }).catch(() => {});
          }

          // 3. Send Native Browser Push Alert
          sendPushToUser(tracker.user_id, {
            title: `⏱️ 4-Hour Radar: ${tracker.origin} → ${tracker.destination}`,
            body: `Current rate: ${tracker.currency} ${Number(currentPrice).toLocaleString()} (${airline}). Actively monitoring 100+ airlines!`,
            url: "/dashboard",
          }).catch(() => {});

          // Record in-app notification
          await supabase.from("notification_logs").insert({
            user_id: tracker.user_id,
            tracker_id: tracker.id,
            route_id: route.id,
            notification_type: "status_update",
            previous_price: lastNotifiedPrice,
            current_price: currentPrice,
            currency: tracker.currency,
            delivery_status: "sent",
            idempotency_key: crypto.randomUUID(),
            sent_at: nowIso,
            is_read: false,
          });

          // Update tracker notification state
          await supabase
            .from("tracked_flights")
            .update({
              last_notified_price: currentPrice,
              last_notified_at: nowIso,
            })
            .eq("id", tracker.id);
        }
      }
    }

    return {
      ok: true,
      routeId: route.id,
      routeKey: route.route_key,
      price: bestPrice,
      airline,
      bookingUrl,
      notificationsSent,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Polling exception";
    console.error(`pollSingleRoute failed for ${route.origin} → ${route.destination}:`, err);

    await supabase
      .from("monitored_routes")
      .update({
        last_checked_at: nowIso,
        next_check_at: nextCheckIso,
        failure_count: (route.failure_count || 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", route.id);

    return {
      ok: false,
      routeId: route.id,
      routeKey: route.route_key,
      notificationsSent: 0,
      error: errorMsg,
    };
  }
}

/**
 * Polls all active routes that are due (next_check_at <= NOW() or last_price is NULL).
 * Writes a row to polling_runs table.
 */
export async function pollAllDueRoutes(options?: {
  limit?: number;
  forceAll?: boolean;
  forceAlerts?: boolean;
}): Promise<PollCycleResult> {
  const supabase = createAdminClient();
  const limit = options?.limit || 25;
  const now = new Date();
  const nowIso = now.toISOString();

  // Create running record in polling_runs
  const { data: runRow } = await supabase
    .from("polling_runs")
    .insert({
      status: "running",
      started_at: nowIso,
    })
    .select("id")
    .single();

  const runId = runRow?.id;

  try {
    // 1. Auto-heal any routes that active users are monitoring
    const { data: activeTrackers } = await supabase
      .from("tracked_flights")
      .select("route_id")
      .eq("is_active", true);

    const activeRouteIds = Array.from(
      new Set((activeTrackers || []).map((t) => t.route_id).filter(Boolean))
    );

    if (activeRouteIds.length > 0) {
      await supabase
        .from("monitored_routes")
        .update({ status: "active", failure_count: 0 })
        .in("id", activeRouteIds)
        .neq("status", "active");
    }

    let query = supabase
      .from("monitored_routes")
      .select("id, origin, destination, departure_date, last_price, next_check_at, status")
      .eq("status", "active")
      .order("next_check_at", { ascending: true })
      .limit(limit);

    if (!options?.forceAll) {
      // Due if next_check_at <= NOW() + 25m jitter buffer, or last_checked_at is older than 3.5h, or last_price is NULL
      const dueBuffer = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
      const staleBuffer = new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString();
      query = query.or(`next_check_at.lte.${dueBuffer},last_checked_at.lte.${staleBuffer},last_price.is.null`);
    }

    const { data: dueRoutes, error: queryErr } = await query;

    if (queryErr) {
      throw new Error(`Failed to query due routes: ${queryErr.message}`);
    }

    const routes = dueRoutes || [];
    let succeeded = 0;
    let failed = 0;
    let totalNotifications = 0;
    const details: PollRouteResult[] = [];

    for (const route of routes) {
      const res = await pollSingleRoute(route.id, {
        forceAlerts: options?.forceAlerts,
      });
      details.push(res);
      if (res.ok) {
        succeeded++;
        totalNotifications += res.notificationsSent;
      } else {
        failed++;
      }
    }

    // Finish polling run record
    if (runId) {
      await supabase
        .from("polling_runs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          routes_claimed: routes.length,
          routes_succeeded: succeeded,
          routes_failed: failed,
          notifications_sent: totalNotifications,
        })
        .eq("id", runId);
    }

    return {
      ok: true,
      runId,
      claimed: routes.length,
      succeeded,
      failed,
      notificationsSent: totalNotifications,
      details,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Poll cycle exception";
    console.error("pollAllDueRoutes failed:", err);

    if (runId) {
      await supabase
        .from("polling_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq("id", runId);
    }

    return {
      ok: false,
      runId,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      notificationsSent: 0,
      details: [],
      error: errorMsg,
    };
  }
}
