"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { CreateTrackerSchema } from "@/lib/validations/tracker";
import { buildTrackerCreatedEmail, sendEmail } from "@/lib/email/smtp";
import { sendTelegramAlert } from "@/lib/telegram/server";
import { sendPushToUser } from "@/lib/push/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function createTrackerAction(rawInput: unknown): Promise<ActionResult> {
  await getAuthenticatedProfile();

  const parsed = CreateTrackerSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldName = firstIssue?.path?.join(".") || "input";
    const msg =
      firstIssue?.message && firstIssue.message !== "Invalid input"
        ? firstIssue.message
        : `Invalid parameter for ${fieldName}`;
    return {
      ok: false,
      message: msg,
    };
  }

  const v = parsed.data;
  const supabase = await createClient();

  const { data: createdTrackerId, error } = await supabase.rpc("create_tracked_flight", {
    p_origin: v.origin,
    p_destination: v.destination,
    p_departure_date: v.departureDate,
    p_return_date: v.tripType === "round_trip" && v.returnDate ? v.returnDate : null,
    p_trip_type: v.tripType,
    p_adults: v.adults,
    p_children: v.children,
    p_infants: v.infants,
    p_cabin_class: v.cabinClass,
    p_currency: v.currency,
    p_target_price: v.targetPrice,
    p_provider: "travelpayouts",
    p_flight_number: v.flightNumber || null,
    p_airline_code: v.airlineCode || null,
    p_airline_name: v.airlineName || null,
    p_departure_time: v.departureTime || null,
    p_arrival_time: v.arrivalTime || null,
    p_itinerary_fingerprint: v.itineraryFingerprint || null,
    p_booking_url: v.bookingUrl || null,
    p_tracking_mode: v.trackingMode || (v.flightNumber ? "exact_flight" : "route"),
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "You are already tracking this exact flight route and date.",
      };
    }
    return {
      ok: false,
      message: error.message || "Could not create flight tracker",
    };
  }

  // Dispatch email notification to user via SMTP if configured
  const { user, profile } = await getAuthenticatedProfile();
  
  // Record in-app notification confirming tracker activation
  await supabase
    .from("notification_logs")
    .insert({
      user_id: user.id,
      tracker_id: typeof createdTrackerId === "string" ? createdTrackerId : null,
      notification_type: "system",
      current_price: v.targetPrice,
      currency: v.currency,
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
      is_read: false,
    });

  if (user.email) {
    sendEmail({
      to: user.email,
      subject: `✈️ Tracker Activated: ${v.origin} → ${v.destination} (${v.currency} ${v.targetPrice})`,
      html: buildTrackerCreatedEmail({
        origin: v.origin,
        destination: v.destination,
        departureDate: v.departureDate,
        targetPrice: v.targetPrice,
        currency: v.currency,
      }),
    }).catch(() => {});
  }

  // Instant Telegram notification on tracker creation
  if (profile.telegram_chat_id) {
    const text = [
      "✈️ <b>RADAR TRACKER ACTIVATED</b>",
      "",
      `Route: <b>${v.origin} → ${v.destination}</b>`,
      `Departure: <b>${v.departureDate}</b>${v.returnDate ? ` (Return: <b>${v.returnDate}</b>)` : ""}`,
      `Target Price: <b>${v.currency} ${Number(v.targetPrice).toLocaleString()}</b>`,
      "",
      "AeroDrop's automated radar is now monitoring this route every 4 hours. You will receive an instant alert here the moment fares drop below your target!",
    ].join("\n");
    sendTelegramAlert({ chatId: profile.telegram_chat_id, text }).catch(() => {});
  }

  // Native Browser Push Notification
  sendPushToUser(user.id, {
    title: "✈️ Radar Tracker Activated",
    body: `${v.origin} → ${v.destination} · Alert target: ${v.currency} ${Number(v.targetPrice).toLocaleString()}`,
    url: "/dashboard",
  }).catch(() => {});

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trackers");
  revalidatePath("/dashboard/notifications");
  return { ok: true, message: "Flight tracker created successfully" };
}

export async function markNotificationAsReadAction(
  notificationId: string,
  isRead: boolean = true,
): Promise<ActionResult> {
  const { user } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_logs")
    .update({
      is_read: isRead,
      read_at: isRead ? new Date().toISOString() : null,
    })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to update notification status" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return { ok: true, message: isRead ? "Marked as read" : "Marked as unread" };
}

export async function markAllNotificationsAsReadAction(): Promise<ActionResult> {
  const { user } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) {
    // Fallback direct update if RPC is missing
    await supabase
      .from("notification_logs")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return { ok: true, message: "All notifications marked as read" };
}

export async function deleteNotificationAction(notificationId: string): Promise<ActionResult> {
  const { user } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_logs")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to delete notification" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return { ok: true, message: "Notification deleted" };
}

export async function toggleTrackerAction(
  trackerId: string,
  nextActive: boolean,
): Promise<ActionResult> {
  const { user, profile } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { data: tracker } = await supabase
    .from("tracked_flights")
    .select("origin, destination, departure_date, currency, target_price")
    .eq("id", trackerId)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("tracked_flights")
    .update({ is_active: nextActive })
    .eq("id", trackerId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to update tracker status" };
  }

  // Instant Telegram notification on pause / resume
  if (profile.telegram_chat_id && tracker) {
    const statusEmoji = nextActive ? "▶️" : "⏸️";
    const statusTitle = nextActive ? "TRACKER RESUMED" : "TRACKER PAUSED";
    const statusDesc = nextActive
      ? "Flight radar monitoring is active again. Next 4-hour cycle will check live fares."
      : "Flight radar monitoring is paused. Background checks for this route are suspended.";
    const text = [
      `${statusEmoji} <b>${statusTitle}</b>`,
      "",
      `Route: <b>${tracker.origin} → ${tracker.destination}</b>`,
      `Departure: <b>${tracker.departure_date}</b>`,
      `Target Alert: <b>${tracker.currency} ${Number(tracker.target_price).toLocaleString()}</b>`,
      "",
      statusDesc,
    ].join("\n");
    sendTelegramAlert({ chatId: profile.telegram_chat_id, text }).catch(() => {});
  }

  // Native Browser Push Notification
  if (tracker) {
    sendPushToUser(user.id, {
      title: nextActive ? "▶️ Tracker Resumed" : "⏸️ Tracker Paused",
      body: `${tracker.origin} → ${tracker.destination} (${tracker.departure_date})`,
      url: "/dashboard/trackers",
    }).catch(() => {});
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trackers");
  return {
    ok: true,
    message: nextActive ? "Tracker resumed" : "Tracker paused",
  };
}

export async function deleteTrackerAction(trackerId: string): Promise<ActionResult> {
  const { user, profile } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { data: tracker } = await supabase
    .from("tracked_flights")
    .select("origin, destination, departure_date, currency, target_price")
    .eq("id", trackerId)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("tracked_flights")
    .delete()
    .eq("id", trackerId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to delete tracker" };
  }

  // Instant Telegram notification on tracker deletion
  if (profile.telegram_chat_id && tracker) {
    const text = [
      "🗑️ <b>TRACKER REMOVED</b>",
      "",
      `Route: <b>${tracker.origin} → ${tracker.destination}</b> (${tracker.departure_date})`,
      "",
      "This route has been permanently removed from your active radar tracking.",
    ].join("\n");
    sendTelegramAlert({ chatId: profile.telegram_chat_id, text }).catch(() => {});
  }

  // Native Browser Push Notification
  if (tracker) {
    sendPushToUser(user.id, {
      title: "🗑️ Tracker Removed",
      body: `${tracker.origin} → ${tracker.destination} (${tracker.departure_date})`,
      url: "/dashboard/trackers",
    }).catch(() => {});
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trackers");
  return { ok: true, message: "Tracker deleted" };
}

export async function disconnectTelegramAction(): Promise<ActionResult> {
  await getAuthenticatedProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("disconnect_telegram");
  if (error) {
    return { ok: false, message: "Failed to disconnect Telegram" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Telegram disconnected" };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
