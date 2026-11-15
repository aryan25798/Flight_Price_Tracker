import { createClient } from "@/lib/supabase/server";

interface SendTelegramAlertParams {
  chatId: string;
  text: string;
}

export async function sendTelegramAlert({
  chatId,
  text,
}: SendTelegramAlertParams): Promise<boolean> {
  if (!chatId || !text) return false;

  // 1. Direct Telegram Bot API if token is present in Next.js env
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) return true;
    } catch (e) {
      console.warn("Direct Telegram send failed, trying edge function fallback:", e);
    }
  }

  // 2. Dispatch via Supabase telegram-link edge function (which has TELEGRAM_BOT_TOKEN secret)
  try {
    let authToken = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

    if (!authToken) {
      try {
        const supabase = await createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        authToken = session?.access_token || null;
      } catch {
        // Outside request context
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl || !authToken) return false;

    const res = await fetch(`${baseUrl}/functions/v1/telegram-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        action: "send_message",
        chatId,
        text,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (json?.ok) return true;
    if (json?.error) {
      console.warn("telegram-link edge dispatch warning:", json.error);
    }
    return false;
  } catch (err) {
    console.error("Failed to dispatch telegram notification:", err);
    return false;
  }
}
