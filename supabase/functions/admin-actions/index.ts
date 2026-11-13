import { z } from "https://esm.sh/zod@3.24.2";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireSuperAdmin } from "../_shared/supabase.ts";
import { sha256Hex } from "../_shared/telegram.ts";

const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const AdminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("get_stats") }),

  z.object({
    action: z.literal("list_users"),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["all", "active", "banned"]).default("all"),
  }).merge(PaginationSchema),

  z.object({
    action: z.literal("get_user_details"),
    userId: z.string().uuid(),
  }),

  z.object({
    action: z.literal("ban_user"),
    userId: z.string().uuid(),
    reason: z.string().trim().max(300).optional(),
  }),

  z.object({
    action: z.literal("unban_user"),
    userId: z.string().uuid(),
    reactivateTrackers: z.boolean().default(false),
  }),

  z.object({
    action: z.literal("delete_user"),
    userId: z.string().uuid(),
  }),

  z.object({
    action: z.literal("list_trackers"),
    email: z.string().trim().max(120).optional(),
    origin: z.string().trim().max(3).optional(),
    destination: z.string().trim().max(3).optional(),
    status: z.enum(["all", "active", "paused"]).default("all"),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).merge(PaginationSchema),

  z.object({
    action: z.literal("create_tracker"),
    userId: z.string().uuid(),
    origin: z.string().trim().length(3).transform((v) => v.toUpperCase()),
    destination: z.string().trim().length(3).transform((v) => v.toUpperCase()),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    tripType: z.enum(["one_way", "round_trip"]),
    adults: z.number().int().min(1).max(9).default(1),
    children: z.number().int().min(0).max(8).default(0),
    infants: z.number().int().min(0).max(9).default(0),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
    currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).default("INR"),
    targetPrice: z.number().positive(),
  }),

  z.object({
    action: z.literal("update_tracker"),
    trackerId: z.string().uuid(),
    targetPrice: z.number().positive().optional(),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isActive: z.boolean().optional(),
  }),

  z.object({
    action: z.literal("delete_tracker"),
    trackerId: z.string().uuid(),
  }),

  z.object({
    action: z.literal("list_audit_logs"),
    search: z.string().trim().max(120).optional(),
    actionFilter: z.string().trim().max(80).optional(),
  }).merge(PaginationSchema),

  z.object({
    action: z.literal("update_settings"),
    settings: z.object({
      polling_interval_minutes: z.number().int().min(60).max(1440).optional(),
      max_api_calls_per_cycle: z.number().int().min(1).max(200).optional(),
      max_concurrent_requests: z.number().int().min(1).max(10).optional(),
      notification_cooldown_hours: z.number().int().min(1).max(168).optional(),
      price_drop_threshold_percent: z.number().min(1).max(50).optional(),
      price_history_retention_days: z.number().int().min(7).max(365).optional(),
      maintenance_mode: z.boolean().optional(),
      max_trackers_per_user: z.number().int().min(1).max(100).optional(),
      max_route_retries: z.number().int().min(1).max(20).optional(),
    }),
  }),

  z.object({ action: z.literal("trigger_poll") }),
]);

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    null
  );
}

async function writeAuditLog(
  supabaseAdmin: Awaited<ReturnType<typeof requireSuperAdmin>> extends { ok: true; ctx: infer C }
    ? C["supabaseAdmin"]
    : never,
  adminId: string,
  action: string,
  targetId: string | null,
  metadata: Record<string, unknown>,
  ipAddress: string | null,
) {
  await supabaseAdmin.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    target_id: targetId,
    metadata,
    ip_address: ipAddress,
  });
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const authCheck = await requireSuperAdmin(req);
  if (!authCheck.ok) {
    return errorResponse(authCheck.message, authCheck.status);
  }

  const { profile: adminProfile, supabaseAdmin } = authCheck.ctx;
  const ipAddress = getClientIp(req);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const parsed = AdminActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message ?? "Invalid request parameters",
      400,
    );
  }

  const input = parsed.data;

  try {
    switch (input.action) {
      case "get_stats": {
        const { data, error } = await supabaseAdmin.rpc("get_admin_dashboard_stats");
        if (error) return errorResponse("Failed to load stats", 500);
        return jsonResponse({ stats: data });
      }

      case "list_users": {
        const from = (input.page - 1) * input.pageSize;
        const to = from + input.pageSize - 1;

        let query = supabaseAdmin
          .from("profiles")
          .select("id, email, role, is_banned, telegram_chat_id, created_at, updated_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (input.search) {
          query = query.ilike("email", `%${input.search}%`);
        }
        if (input.status === "active") {
          query = query.eq("is_banned", false);
        } else if (input.status === "banned") {
          query = query.eq("is_banned", true);
        }

        const { data, count, error } = await query;
        if (error) return errorResponse("Failed to fetch users", 500);

        return jsonResponse({
          users: data ?? [],
          total: count ?? 0,
          page: input.page,
          pageSize: input.pageSize,
        });
      }

      case "get_user_details": {
        const [{ data: user, error: userErr }, { data: trackers }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, email, role, is_banned, telegram_chat_id, created_at, updated_at")
            .eq("id", input.userId)
            .single(),
          supabaseAdmin
            .from("tracked_flights")
            .select("*")
            .eq("user_id", input.userId)
            .order("created_at", { ascending: false }),
        ]);

        if (userErr || !user) return errorResponse("User not found", 404);
        return jsonResponse({ user, trackers: trackers ?? [] });
      }

      case "ban_user": {
        if (input.userId === adminProfile.id) {
          return errorResponse("You cannot ban your own account", 400);
        }

        const { data: targetUser } = await supabaseAdmin
          .from("profiles")
          .select("id, email, role")
          .eq("id", input.userId)
          .single();

        if (!targetUser) return errorResponse("User not found", 404);

        if (targetUser.role === "super_admin") {
          const { count } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "super_admin")
            .eq("is_banned", false);
          if ((count ?? 0) <= 1) {
            return errorResponse("Cannot ban the last active super_admin", 400);
          }
        }

        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
          input.userId,
          { ban_duration: "876000h" },
        );
        if (authErr) return errorResponse("Failed to ban user in Auth", 500);

        await supabaseAdmin
          .from("profiles")
          .update({ is_banned: true })
          .eq("id", input.userId);

        await supabaseAdmin
          .from("tracked_flights")
          .update({ is_active: false })
          .eq("user_id", input.userId)
          .eq("is_active", true);

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "BAN_USER",
          input.userId,
          { email: targetUser.email, reason: input.reason ?? null },
          ipAddress,
        );

        return jsonResponse({ success: true });
      }

      case "unban_user": {
        const { data: targetUser } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .eq("id", input.userId)
          .single();

        if (!targetUser) return errorResponse("User not found", 404);

        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
          input.userId,
          { ban_duration: "none" },
        );
        if (authErr) return errorResponse("Failed to unban user in Auth", 500);

        await supabaseAdmin
          .from("profiles")
          .update({ is_banned: false })
          .eq("id", input.userId);

        if (input.reactivateTrackers) {
          await supabaseAdmin
            .from("tracked_flights")
            .update({ is_active: true })
            .eq("user_id", input.userId)
            .gte("departure_date", new Date().toISOString().slice(0, 10));
        }

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "UNBAN_USER",
          input.userId,
          { email: targetUser.email, reactivateTrackers: input.reactivateTrackers },
          ipAddress,
        );

        return jsonResponse({ success: true });
      }

      case "delete_user": {
        if (input.userId === adminProfile.id) {
          return errorResponse("You cannot delete your own account", 400);
        }

        const { data: targetUser } = await supabaseAdmin
          .from("profiles")
          .select("id, email, role")
          .eq("id", input.userId)
          .single();

        if (!targetUser) return errorResponse("User not found", 404);

        if (targetUser.role === "super_admin") {
          const { count } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "super_admin")
            .eq("is_banned", false);
          if ((count ?? 0) <= 1) {
            return errorResponse("Cannot delete the last active super_admin", 400);
          }
        }

        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(input.userId);
        if (delErr) return errorResponse("Failed to delete user", 500);

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "DELETE_USER",
          input.userId,
          { email: targetUser.email },
          ipAddress,
        );

        return jsonResponse({ success: true });
      }

      case "list_trackers": {
        const from = (input.page - 1) * input.pageSize;
        const to = from + input.pageSize - 1;

        let query = supabaseAdmin
          .from("tracked_flights")
          .select("*, profiles!inner(email)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (input.email) {
          query = query.ilike("profiles.email", `%${input.email}%`);
        }
        if (input.origin) {
          query = query.eq("origin", input.origin.toUpperCase());
        }
        if (input.destination) {
          query = query.eq("destination", input.destination.toUpperCase());
        }
        if (input.status === "active") {
          query = query.eq("is_active", true);
        } else if (input.status === "paused") {
          query = query.eq("is_active", false);
        }
        if (input.departureDate) {
          query = query.eq("departure_date", input.departureDate);
        }

        const { data, count, error } = await query;
        if (error) return errorResponse("Failed to fetch trackers", 500);

        return jsonResponse({
          trackers: data ?? [],
          total: count ?? 0,
          page: input.page,
          pageSize: input.pageSize,
        });
      }

      case "create_tracker": {
        if (input.origin === input.destination) {
          return errorResponse("Origin and destination must differ", 400);
        }
        if (input.tripType === "round_trip" && (!input.returnDate || input.returnDate < input.departureDate)) {
          return errorResponse("Invalid return date for round trip", 400);
        }

        const searchParams = {
          adults: input.adults,
          cabin_class: input.cabinClass,
          children: input.children,
          currency: input.currency,
          departure_date: input.departureDate,
          destination: input.destination,
          infants: input.infants,
          origin: input.origin,
          provider: "travelpayouts",
          return_date: input.tripType === "round_trip" ? (input.returnDate ?? null) : null,
          trip_type: input.tripType,
        };

        const routeKey = await sha256Hex(JSON.stringify(searchParams));

        const { data: routeRow, error: routeErr } = await supabaseAdmin
          .from("monitored_routes")
          .upsert(
            {
              route_key: routeKey,
              search_parameters: searchParams,
              origin: input.origin,
              destination: input.destination,
              departure_date: input.departureDate,
              return_date: searchParams.return_date,
              provider: "travelpayouts",
              status: "active",
            },
            { onConflict: "route_key" },
          )
          .select("id")
          .single();

        if (routeErr || !routeRow) {
          return errorResponse("Failed to resolve monitored route", 500);
        }

        const { data: created, error: createErr } = await supabaseAdmin
          .from("tracked_flights")
          .insert({
            user_id: input.userId,
            route_id: routeRow.id,
            origin: input.origin,
            destination: input.destination,
            departure_date: input.departureDate,
            return_date: searchParams.return_date,
            trip_type: input.tripType,
            adults: input.adults,
            children: input.children,
            infants: input.infants,
            cabin_class: input.cabinClass,
            currency: input.currency,
            target_price: input.targetPrice,
          })
          .select("*")
          .single();

        if (createErr || !created) {
          return errorResponse(createErr?.message ?? "Failed to create tracker", 400);
        }

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "CREATE_TRACKER",
          created.id,
          { userId: input.userId, route: `${input.origin}-${input.destination}` },
          ipAddress,
        );

        return jsonResponse({ tracker: created }, 201);
      }

      case "update_tracker": {
        const updates: Record<string, unknown> = {};
        if (input.targetPrice !== undefined) updates.target_price = input.targetPrice;
        if (input.departureDate !== undefined) updates.departure_date = input.departureDate;
        if (input.isActive !== undefined) updates.is_active = input.isActive;

        if (Object.keys(updates).length === 0) {
          return errorResponse("No fields provided to update", 400);
        }

        const { data: updated, error } = await supabaseAdmin
          .from("tracked_flights")
          .update(updates)
          .eq("id", input.trackerId)
          .select("*")
          .single();

        if (error || !updated) {
          return errorResponse(error?.message ?? "Tracker update failed", 400);
        }

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "UPDATE_TRACKER",
          input.trackerId,
          updates,
          ipAddress,
        );

        return jsonResponse({ tracker: updated });
      }

      case "delete_tracker": {
        const { error } = await supabaseAdmin
          .from("tracked_flights")
          .delete()
          .eq("id", input.trackerId);

        if (error) return errorResponse("Failed to delete tracker", 500);

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "DELETE_TRACKER",
          input.trackerId,
          {},
          ipAddress,
        );

        return jsonResponse({ success: true });
      }

      case "list_audit_logs": {
        const from = (input.page - 1) * input.pageSize;
        const to = from + input.pageSize - 1;

        let query = supabaseAdmin
          .from("admin_audit_logs")
          .select("*, profiles(email)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (input.actionFilter) {
          query = query.eq("action", input.actionFilter);
        }
        if (input.search) {
          query = query.or(
            `action.ilike.%${input.search}%,target_id.ilike.%${input.search}%`,
          );
        }

        const { data, count, error } = await query;
        if (error) return errorResponse("Failed to load audit logs", 500);

        return jsonResponse({
          logs: data ?? [],
          total: count ?? 0,
          page: input.page,
          pageSize: input.pageSize,
        });
      }

      case "update_settings": {
        const entries = Object.entries(input.settings).filter(([, v]) => v !== undefined);
        if (entries.length === 0) {
          return errorResponse("No settings provided", 400);
        }

        for (const [key, value] of entries) {
          await supabaseAdmin
            .from("system_settings")
            .update({ value, updated_by: adminProfile.id })
            .eq("key", key);
        }

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "UPDATE_SETTINGS",
          null,
          input.settings as Record<string, unknown>,
          ipAddress,
        );

        return jsonResponse({ success: true });
      }

      case "trigger_poll": {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const cronSecret = Deno.env.get("CRON_SECRET");
        if (!supabaseUrl || !cronSecret) {
          return errorResponse("Polling configuration missing", 500);
        }

        const resp = await fetch(`${supabaseUrl}/functions/v1/check-flight-prices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": cronSecret,
          },
          body: JSON.stringify({ source: "admin_manual" }),
        });

        const result = await resp.json().catch(() => ({}));

        await writeAuditLog(
          supabaseAdmin,
          adminProfile.id,
          "TRIGGER_POLL",
          null,
          { status: resp.status, result },
          ipAddress,
        );

        return jsonResponse({ status: resp.status, result });
      }
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
    );
  }
});
