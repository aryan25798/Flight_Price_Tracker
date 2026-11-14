import { constantTimeEqual, errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { getFlightProvider } from "../_shared/flight-provider/registry.ts";
import { FlightProviderError, type FlightSearchQuery } from "../_shared/flight-provider/types.ts";
import { createServiceClient, requireSuperAdmin } from "../_shared/supabase.ts";
import {
  formatPriceDropMessage,
  formatRoutineUpdateMessage,
  sendTelegramMessage,
  sha256Hex,
} from "../_shared/telegram.ts";

interface SystemConfig {
  pollingIntervalMinutes: number;
  maxApiCallsPerCycle: number;
  maxConcurrentRequests: number;
  notificationCooldownHours: number;
  priceDropThresholdPercent: number;
  maintenanceMode: boolean;
  maxRouteRetries: number;
}

interface MonitoredRouteRow {
  id: string;
  route_key: string;
  search_parameters: {
    origin: string;
    destination: string;
    departure_date: string;
    return_date?: string | null;
    trip_type: "one_way" | "round_trip";
    adults: number;
    children: number;
    infants: number;
    cabin_class: "economy" | "premium_economy" | "business" | "first";
    currency: string;
  };
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  provider: string;
  last_checked_at: string | null;
  last_price: number | null;
  failure_count: number;
}

interface TrackerWithProfile {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  currency: string;
  target_price: number;
  last_notified_price: number | null;
  last_notified_at: string | null;
  profiles: {
    id: string;
    is_banned: boolean;
    telegram_chat_id: string | null;
    email?: string | null;
  };
}

function parseNumberSetting(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function loadSystemConfig(
  supabaseAdmin: ReturnType<typeof createServiceClient>,
): Promise<SystemConfig> {
  const { data } = await supabaseAdmin.from("system_settings").select("key, value");
  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    map.set(row.key, row.value);
  }

  return {
    pollingIntervalMinutes: parseNumberSetting(map.get("polling_interval_minutes"), 240),
    maxApiCallsPerCycle: Math.min(200, parseNumberSetting(map.get("max_api_calls_per_cycle"), 50)),
    maxConcurrentRequests: Math.min(10, parseNumberSetting(map.get("max_concurrent_requests"), 3)),
    notificationCooldownHours: parseNumberSetting(map.get("notification_cooldown_hours"), 12),
    priceDropThresholdPercent: parseNumberSetting(map.get("price_drop_threshold_percent"), 5),
    maintenanceMode: map.get("maintenance_mode") === true,
    maxRouteRetries: parseNumberSetting(map.get("max_route_retries"), 5),
  };
}

export type TrackerNotificationDecision =
  | { eligible: true; type: "price_drop"; isUrgent: boolean }
  | { eligible: true; type: "status_update"; isUrgent: false }
  | { eligible: false; reason: string };

export function evaluateTrackerNotification(
  currentPrice: number,
  targetPrice: number,
  lastNotifiedPrice: number | null,
  lastNotifiedAt: string | null,
  cooldownHours: number,
  dropThresholdPercent: number,
  nowMs: number,
): TrackerNotificationDecision {
  const lastNotifiedMs = lastNotifiedAt ? new Date(lastNotifiedAt).getTime() : 0;
  const hoursSinceLastAlert = lastNotifiedAt ? (nowMs - lastNotifiedMs) / (1000 * 60 * 60) : 9999;

  // Case 1: Current price is at or below the user's target alert threshold (or dropped significantly)
  if (currentPrice <= targetPrice) {
    if (!lastNotifiedAt || lastNotifiedPrice === null) {
      return { eligible: true, type: "price_drop", isUrgent: true };
    }

    // Significant drop of >= 5% from last notified price always fires immediately
    const dropThreshold = lastNotifiedPrice * (1 - dropThresholdPercent / 100);
    if (currentPrice <= dropThreshold) {
      return { eligible: true, type: "price_drop", isUrgent: true };
    }

    // If price decreased compared to last notified price
    if (currentPrice < lastNotifiedPrice) {
      return { eligible: true, type: "price_drop", isUrgent: true };
    }

    // If price is the same, respect cooldown
    if (hoursSinceLastAlert >= cooldownHours) {
      return { eligible: true, type: "price_drop", isUrgent: false };
    }

    return { eligible: false, reason: "price_drop_cooldown_active" };
  }

  // Case 2: Price is currently above target price -> Send 4-hour routine status update
  // User requested: "send updates every 4 hours even if no price decrease"
  if (!lastNotifiedAt || hoursSinceLastAlert >= 3.5) {
    return { eligible: true, type: "status_update", isUrgent: false };
  }

  return { eligible: false, reason: "routine_update_cooldown_active" };
}

export function isTrackerEligibleForAlert(
  currentPrice: number,
  targetPrice: number,
  lastNotifiedPrice: number | null,
  lastNotifiedAt: string | null,
  cooldownHours: number,
  dropThresholdPercent: number,
  nowMs: number,
): boolean {
  const res = evaluateTrackerNotification(
    currentPrice,
    targetPrice,
    lastNotifiedPrice,
    lastNotifiedAt,
    cooldownHours,
    dropThresholdPercent,
    nowMs,
  );
  return res.eligible;
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Authenticate either via CRON_SECRET header or verified super_admin JWT
  const cronSecret = Deno.env.get("CRON_SECRET");
  const incomingSecret = req.headers.get("x-cron-secret");
  let authorized = false;

  if (cronSecret && incomingSecret && constantTimeEqual(incomingSecret, cronSecret)) {
    authorized = true;
  } else {
    const adminCheck = await requireSuperAdmin(req);
    if (adminCheck.ok) {
      authorized = true;
    }
  }

  if (!authorized) {
    return errorResponse("Unauthorized", 401);
  }

  const supabaseAdmin = createServiceClient();
  let lockAcquired = false;
  let runId: string | null = null;

  try {
    const config = await loadSystemConfig(supabaseAdmin);

    if (config.maintenanceMode) {
      await supabaseAdmin.from("polling_runs").insert({
        status: "skipped_maintenance",
        finished_at: new Date().toISOString(),
      });
      return jsonResponse({ status: "skipped_maintenance" });
    }

    const { data: lockResult, error: lockError } = await supabaseAdmin.rpc("acquire_polling_lock");
    if (lockError || lockResult !== true) {
      await supabaseAdmin.from("polling_runs").insert({
        status: "skipped_lock",
        finished_at: new Date().toISOString(),
      });
      return jsonResponse({ status: "skipped_lock" });
    }
    lockAcquired = true;

    const { data: runRow } = await supabaseAdmin
      .from("polling_runs")
      .insert({ status: "running" })
      .select("id")
      .single();
    runId = runRow?.id ?? null;

    // Run housekeeping before claiming routes
    await supabaseAdmin.rpc("cleanup_expired_data");

    const { data: claimedRoutes, error: claimError } = await supabaseAdmin.rpc(
      "claim_due_routes",
      { p_limit: config.maxApiCallsPerCycle },
    );

    if (claimError) {
      throw new Error(`Failed to claim routes: ${claimError.message}`);
    }

    const routes = (claimedRoutes ?? []) as MonitoredRouteRow[];
    let succeeded = 0;
    let failed = 0;
    let notificationsSent = 0;

    // Process routes in bounded concurrent chunks
    for (let i = 0; i < routes.length; i += config.maxConcurrentRequests) {
      const batch = routes.slice(i, i + config.maxConcurrentRequests);

      const results = await Promise.all(
        batch.map(async (route) => {
          const now = new Date();
          const nowIso = now.toISOString();
          const nextCheckIso = new Date(
            now.getTime() + config.pollingIntervalMinutes * 60_000,
          ).toISOString();

          try {
            const provider = getFlightProvider(route.provider);
            const sp = route.search_parameters;
            const query: FlightSearchQuery = {
              routeKey: route.route_key,
              origin: sp?.origin ?? route.origin,
              destination: sp?.destination ?? route.destination,
              departureDate: sp?.departure_date ?? route.departure_date,
              returnDate: sp?.return_date ?? route.return_date,
              tripType: sp?.trip_type ?? (route.return_date ? "round_trip" : "one_way"),
              adults: sp?.adults ?? 1,
              children: sp?.children ?? 0,
              infants: sp?.infants ?? 0,
              cabinClass: sp?.cabin_class ?? "economy",
              currency: sp?.currency ?? "INR",
            };

            const offer = await provider.searchFlights(query);

            if (!offer) {
              await supabaseAdmin
                .from("monitored_routes")
                .update({
                  last_checked_at: nowIso,
                  next_check_at: nextCheckIso,
                  failure_count: 0,
                })
                .eq("id", route.id);
              return { ok: true, sent: 0 };
            }

            // Record price_history only when price changed or sufficient time passed
            const prevPrice = route.last_price !== null ? Number(route.last_price) : null;
            const priceChanged = prevPrice === null || prevPrice !== offer.price;
            const lastCheckedMs = route.last_checked_at
              ? new Date(route.last_checked_at).getTime()
              : 0;
            const hoursSinceLastHistory = (now.getTime() - lastCheckedMs) / 3_600_000;

            if (priceChanged || hoursSinceLastHistory >= config.pollingIntervalMinutes / 60) {
              await supabaseAdmin.from("price_history").insert({
                route_id: route.id,
                route_key: route.route_key,
                price: offer.price,
                currency: offer.currency,
                airline: offer.airline,
                booking_url: offer.bookingUrl,
                provider: offer.provider,
                checked_at: nowIso,
              });
            }

            await supabaseAdmin
              .from("monitored_routes")
              .update({
                last_price: offer.price,
                last_airline: offer.airline,
                last_booking_url: offer.bookingUrl,
                last_checked_at: nowIso,
                next_check_at: nextCheckIso,
                failure_count: 0,
              })
              .eq("id", route.id);

            // Evaluate all active trackers subscribed to this route
            const { data: trackers } = await supabaseAdmin
              .from("tracked_flights")
              .select(`
                id, user_id, origin, destination, departure_date, return_date,
                currency, target_price, last_notified_price, last_notified_at,
                profiles!inner(id, is_banned, telegram_chat_id, email)
              `)
              .eq("route_id", route.id)
              .eq("is_active", true)
              .eq("profiles.is_banned", false);

            const activeTrackers = (trackers ?? []) as unknown as TrackerWithProfile[];

            // Batch update last_seen_price on active trackers for this route
            if (activeTrackers.length > 0) {
              await supabaseAdmin
                .from("tracked_flights")
                .update({ last_seen_price: offer.price })
                .eq("route_id", route.id)
                .eq("is_active", true);
            }

            let routeSentCount = 0;
            // 4-hour bucket for idempotency key
            const hourBucket = Math.floor(now.getTime() / (config.pollingIntervalMinutes * 60_000));

            // SCALE-01: Filter eligible trackers and determine notification type (price_drop vs status_update)
            const eligibleTrackers = activeTrackers
              .map((tracker) => {
                if (!tracker.profiles?.telegram_chat_id && !tracker.profiles?.email) return null;
                const targetPrice = Number(tracker.target_price);
                const lastNotifiedPrice =
                  tracker.last_notified_price !== null
                    ? Number(tracker.last_notified_price)
                    : null;

                const decision = evaluateTrackerNotification(
                  offer.price,
                  targetPrice,
                  lastNotifiedPrice,
                  tracker.last_notified_at,
                  config.notificationCooldownHours,
                  config.priceDropThresholdPercent,
                  now.getTime(),
                );

                if (!decision.eligible) return null;
                return { tracker, decision };
              })
              .filter(
                (
                  item,
                ): item is {
                  tracker: TrackerWithProfile;
                  decision: { eligible: true; type: "price_drop" | "status_update"; isUrgent: boolean };
                } => item !== null,
              );

            // Process notifications in concurrent chunks of 20 (respecting Telegram's 30 msg/sec global limit)
            const NOTIFY_CHUNK_SIZE = 20;
            for (let b = 0; b < eligibleTrackers.length; b += NOTIFY_CHUNK_SIZE) {
              const trackerChunk = eligibleTrackers.slice(b, b + NOTIFY_CHUNK_SIZE);

              const chunkResults = await Promise.allSettled(
                trackerChunk.map(async ({ tracker, decision }) => {
                  const chatId = tracker.profiles.telegram_chat_id;
                  const email = tracker.profiles.email;
                  const targetPrice = Number(tracker.target_price);
                  const lastNotifiedPrice =
                    tracker.last_notified_price !== null
                      ? Number(tracker.last_notified_price)
                      : null;

                  const idempotencyKey = await sha256Hex(
                    `${tracker.id}:${hourBucket}:${offer.price}:${decision.type}`,
                  );

                  const { error: insertLogErr } = await supabaseAdmin
                    .from("notification_logs")
                    .insert({
                      user_id: tracker.user_id,
                      tracker_id: tracker.id,
                      route_id: route.id,
                      notification_type: decision.type,
                      previous_price: lastNotifiedPrice,
                      current_price: offer.price,
                      currency: offer.currency,
                      delivery_status: "pending",
                      idempotency_key: idempotencyKey,
                      is_read: false,
                    });

                  // Skip if another worker already claimed this idempotency_key
                  if (insertLogErr) {
                    return { sent: false };
                  }

                  let tgSent = false;
                  let tgMessageId: number | null = null;
                  let emailSent = false;

                  if (chatId) {
                    const messageHtml =
                      decision.type === "price_drop"
                        ? formatPriceDropMessage({
                            origin: tracker.origin,
                            destination: tracker.destination,
                            departureDate: tracker.departure_date,
                            returnDate: tracker.return_date,
                            airline: offer.airline,
                            previousPrice: lastNotifiedPrice,
                            currentPrice: offer.price,
                            targetPrice,
                            currency: offer.currency,
                            bookingUrl: offer.bookingUrl,
                          })
                        : formatRoutineUpdateMessage({
                            origin: tracker.origin,
                            destination: tracker.destination,
                            departureDate: tracker.departure_date,
                            returnDate: tracker.return_date,
                            airline: offer.airline,
                            currentPrice: offer.price,
                            targetPrice,
                            currency: offer.currency,
                            bookingUrl: offer.bookingUrl,
                          });

                    const tgResult = await sendTelegramMessage(chatId, messageHtml);
                    tgSent = tgResult.ok;
                    tgMessageId = tgResult.messageId ?? null;
                  }

                  // Dispatch Custom SMTP Email for price drops or 4-hour routine radar updates
                  if (email && (decision.type === "price_drop" || decision.type === "status_update")) {
                    try {
                      const appUrl =
                        Deno.env.get("APP_URL") ||
                        Deno.env.get("NEXT_PUBLIC_APP_URL") ||
                        "https://flight-price-tracker-nu.vercel.app";
                      const secret =
                        Deno.env.get("CRON_SECRET") ||
                        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
                        "";
                      const emailRes = await fetch(`${appUrl}/api/notify-email`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-internal-secret": secret,
                        },
                        body: JSON.stringify({
                          to: email,
                          type: decision.type,
                          data: {
                            origin: tracker.origin,
                            destination: tracker.destination,
                            departureDate: tracker.departure_date,
                            returnDate: tracker.return_date,
                            airline: offer.airline,
                            currentPrice: offer.price,
                            targetPrice,
                            currency: offer.currency,
                            bookingUrl: offer.bookingUrl,
                          },
                        }),
                      });
                      if (emailRes.ok) {
                        emailSent = true;
                      }
                    } catch (e) {
                      console.error("Email notification dispatch error:", e);
                    }
                  }

                  const isDelivered = tgSent || emailSent || (!chatId && Boolean(email));

                  if (isDelivered) {
                    const sentAt = new Date().toISOString();
                    await supabaseAdmin
                      .from("notification_logs")
                      .update({
                        delivery_status: "sent",
                        telegram_message_id: tgMessageId,
                        sent_at: sentAt,
                      })
                      .eq("idempotency_key", idempotencyKey);

                    await supabaseAdmin
                      .from("tracked_flights")
                      .update({
                        last_notified_price: offer.price,
                        last_notified_at: sentAt,
                      })
                      .eq("id", tracker.id);

                    return { sent: true };
                  } else {
                    await supabaseAdmin
                      .from("notification_logs")
                      .update({
                        delivery_status: "failed",
                        error_message: "Failed to dispatch Telegram or Email alert",
                      })
                      .eq("idempotency_key", idempotencyKey);

                    return { sent: false };
                  }
                }),
              );

              for (const res of chunkResults) {
                if (res.status === "fulfilled" && res.value.sent) {
                  routeSentCount++;
                }
              }

              // Pause 1000ms between chunks of 20 to strictly respect Telegram broadcast limits
              if (b + NOTIFY_CHUNK_SIZE < eligibleTrackers.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }

            return { ok: true, sent: routeSentCount };
          } catch (routeErr) {
            const nextFailures = route.failure_count + 1;
            const retryable =
              routeErr instanceof FlightProviderError ? routeErr.retryable : true;
            const shouldFailRoute =
              !retryable || nextFailures >= config.maxRouteRetries;

            const backoffMinutes = Math.min(
              1440,
              config.pollingIntervalMinutes * Math.pow(2, Math.max(0, nextFailures - 1)),
            );

            await supabaseAdmin
              .from("monitored_routes")
              .update({
                failure_count: nextFailures,
                status: shouldFailRoute ? "failed" : "active",
                next_check_at: new Date(now.getTime() + backoffMinutes * 60_000).toISOString(),
              })
              .eq("id", route.id);

            return { ok: false, sent: 0 };
          }
        }),
      );

      for (const r of results) {
        if (r.ok) succeeded++;
        else failed++;
        notificationsSent += r.sent;
      }
    }

    if (runId) {
      await supabaseAdmin
        .from("polling_runs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          routes_claimed: routes.length,
          routes_succeeded: succeeded,
          routes_failed: failed,
          notifications_sent: notificationsSent,
        })
        .eq("id", runId);
    }

    return jsonResponse({
      status: "completed",
      routes_claimed: routes.length,
      routes_succeeded: succeeded,
      routes_failed: failed,
      notifications_sent: notificationsSent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Polling execution failed";
    if (runId) {
      await supabaseAdmin
        .from("polling_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: message.slice(0, 500),
        })
        .eq("id", runId);
    }
    return errorResponse("Polling execution failed", 500);
  } finally {
    if (lockAcquired) {
      await supabaseAdmin.rpc("release_polling_lock");
    }
  }
});
