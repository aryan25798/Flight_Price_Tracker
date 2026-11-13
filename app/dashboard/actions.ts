"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { CreateTrackerSchema } from "@/lib/validations/tracker";
import { buildTrackerCreatedEmail, sendEmail } from "@/lib/email/smtp";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function createTrackerAction(rawInput: unknown): Promise<ActionResult> {
  await getAuthenticatedProfile();

  const parsed = CreateTrackerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid flight search parameters",
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
  const { user } = await getAuthenticatedProfile();
  
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
  const { user } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tracked_flights")
    .update({ is_active: nextActive })
    .eq("id", trackerId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to update tracker status" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trackers");
  return {
    ok: true,
    message: nextActive ? "Tracker resumed" : "Tracker paused",
  };
}

export async function deleteTrackerAction(trackerId: string): Promise<ActionResult> {
  const { user } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tracked_flights")
    .delete()
    .eq("id", trackerId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to delete tracker" };
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
