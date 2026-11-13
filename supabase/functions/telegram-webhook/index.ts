import { z } from "https://esm.sh/zod@3.24.2";
import { constantTimeEqual, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { sendTelegramMessage, sha256Hex } from "../_shared/telegram.ts";

const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      text: z.string().optional(),
      chat: z.object({
        id: z.union([z.number(), z.string()]),
        type: z.string(),
      }),
      from: z
        .object({
          id: z.number(),
          is_bot: z.boolean().optional(),
          first_name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");

  if (!expectedSecret || !incomingSecret || !constantTimeEqual(incomingSecret, expectedSecret)) {
    return errorResponse("Unauthorized webhook request", 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const parsed = TelegramUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResponse({ ok: true });
  }

  const message = parsed.data.message;
  if (!message || message.from?.is_bot || message.chat.type !== "private") {
    return jsonResponse({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();

  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const token = parts[1]?.trim();

    if (!token || token.length < 16) {
      await sendTelegramMessage(
        chatId,
        [
          "👋 <b>Welcome to Flight Price Drop Tracker!</b>",
          "",
          "To link your account, open your dashboard settings and click <b>Link Telegram</b> to generate a secure connection link.",
        ].join("\n"),
      );
      return jsonResponse({ ok: true });
    }

    const tokenHash = await sha256Hex(token);
    const supabaseAdmin = createServiceClient();
    const nowIso = new Date().toISOString();

    // Atomic single-use lookup + update prevents replay attacks
    const { data: linkedProfile, error } = await supabaseAdmin
      .from("profiles")
      .update({
        telegram_chat_id: chatId,
        telegram_link_token_hash: null,
        telegram_link_expires_at: null,
      })
      .eq("telegram_link_token_hash", tokenHash)
      .gt("telegram_link_expires_at", nowIso)
      .eq("is_banned", false)
      .select("id, email")
      .maybeSingle();

    if (error || !linkedProfile) {
      await sendTelegramMessage(
        chatId,
        "❌ This linking token is invalid, expired, or has already been used. Please generate a new link from your dashboard.",
      );
      return jsonResponse({ ok: true });
    }

    const confirmHtml = [
      "✅ <b>Telegram Linked Successfully!</b>",
      "",
      "Your account is now connected. You will receive instant flight price-drop alerts right here.",
    ].join("\n");

    const tgRes = await sendTelegramMessage(chatId, confirmHtml);

    const idempotencyKey = await sha256Hex(`link-confirm:${linkedProfile.id}:${nowIso}`);
    await supabaseAdmin.from("notification_logs").insert({
      user_id: linkedProfile.id,
      notification_type: "test",
      delivery_status: tgRes.ok ? "sent" : "failed",
      telegram_message_id: tgRes.messageId ?? null,
      idempotency_key: idempotencyKey,
      error_message: tgRes.error ?? null,
      sent_at: tgRes.ok ? nowIso : null,
    });

    return jsonResponse({ ok: true });
  }

  await sendTelegramMessage(
    chatId,
    "✈️ Manage your flight price trackers in the web dashboard. Use /start with a valid dashboard link to connect your account.",
  );
  return jsonResponse({ ok: true });
});
