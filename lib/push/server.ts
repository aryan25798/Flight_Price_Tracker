import { setVapidDetails, sendNotification } from "web-push";
import { createClient } from "@/lib/supabase/server";

export const FALLBACK_VAPID_PUBLIC_KEY =
  "BJ8vwvXze5OJCIyVBd18NfT8BYzWAjXoY6TtMYIzANGf0nwUZ-t6GI9tM6vYtnUUxTffU_08-p9ymAaZq5Xff5s";
export const FALLBACK_VAPID_PRIVATE_KEY =
  "jdTu7cVKbZQ9CqOOTgOAeAMEBzemX1b4Ty4YA25m_Fs";
export const FALLBACK_VAPID_SUBJECT =
  "mailto:update.infoviamail@gmail.com";

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;
  const privateKey =
    process.env.VAPID_PRIVATE_KEY || FALLBACK_VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || FALLBACK_VAPID_SUBJECT;

  if (!publicKey || !privateKey) {
    console.warn("VAPID keys not configured. Browser push notifications disabled.");
    return false;
  }

  try {
    setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error("Failed to initialize VAPID configuration:", err);
    return false;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

export async function sendWebPushNotification({
  endpoint,
  p256dh,
  auth,
  payload,
}: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: PushNotificationPayload;
}): Promise<boolean> {
  if (!ensureVapidConfig()) return false;

  const pushSubscription = {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };

  try {
    await sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    // 404 Not Found or 410 Gone means the subscription is no longer valid
    if (statusCode === 404 || statusCode === 410) {
      console.log(`Cleaning up expired push subscription for endpoint: ${endpoint}`);
      try {
        const supabase = await createClient();
        await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      } catch (cleanErr) {
        console.error("Failed to clean up expired subscription:", cleanErr);
      }
    } else {
      console.error("Web push delivery failed:", error);
    }
    return false;
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload,
): Promise<{ total: number; sent: number }> {
  const supabase = await createClient();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) {
    return { total: 0, sent: 0 };
  }

  const results = await Promise.allSettled(
    subs.map((s) =>
      sendWebPushNotification({
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
        payload,
      }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  return { total: subs.length, sent };
}
