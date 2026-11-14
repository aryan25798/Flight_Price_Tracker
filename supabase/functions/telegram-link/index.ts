import { z } from "https://esm.sh/zod@3.24.2";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAuthenticatedUser } from "../_shared/supabase.ts";
import { sendTelegramMessage, sha256Hex } from "../_shared/telegram.ts";

const TelegramLinkRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate_link") }),
  z.object({ action: z.literal("send_test") }),
  z.object({
    action: z.literal("send_message"),
    chatId: z.string(),
    text: z.string(),
  }),
]);

function generateRandomHexToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const authCheck = await requireAuthenticatedUser(req);
  if (!authCheck.ok) {
    return errorResponse(authCheck.message, authCheck.status);
  }

  const { profile, supabaseAdmin } = authCheck.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const parsed = TelegramLinkRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse("Invalid action", 400);
  }

  if (parsed.data.action === "generate_link") {
    const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME");
    if (!botUsername) {
      return errorResponse("TELEGRAM_BOT_USERNAME is not configured", 500);
    }

    const token = generateRandomHexToken(24); // 48-char hex token (within Telegram's 64-char /start limit)
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        telegram_link_token_hash: tokenHash,
        telegram_link_expires_at: expiresAt,
      })
      .eq("id", profile.id);

    if (error) {
      return errorResponse("Failed to generate Telegram link token", 500);
    }

    return jsonResponse({
      deep_link: `https://t.me/${botUsername}?start=${token}`,
      expires_at: expiresAt,
    });
  }

  if (parsed.data.action === "send_message") {
    if (parsed.data.chatId !== profile.telegram_chat_id && profile.role !== "super_admin") {
      return errorResponse("Forbidden: Cannot dispatch to unverified chat", 403);
    }
    const res = await sendTelegramMessage(parsed.data.chatId, parsed.data.text);
    return jsonResponse({ ok: res.ok, error: res.error });
  }

  // action === "send_test"
  if (!profile.telegram_chat_id) {
    return errorResponse("Telegram account is not linked yet", 400);
  }

  const testHtml = [
    "✈️ <b>TEST NOTIFICATION</b>",
    "",
    "Your Flight Price Drop Tracker is connected to this Telegram chat.",
    "You will receive instant alerts here whenever a tracked route drops below your target price.",
  ].join("\n");

  const idempotencyKey = await sha256Hex(
    `test:${profile.id}:${Math.floor(Date.now() / 10_000)}`,
  );

  const tgResult = await sendTelegramMessage(profile.telegram_chat_id, testHtml);
  const nowIso = new Date().toISOString();

  await supabaseAdmin.from("notification_logs").upsert(
    {
      user_id: profile.id,
      notification_type: "test",
      delivery_status: tgResult.ok ? "sent" : "failed",
      telegram_message_id: tgResult.messageId ?? null,
      idempotency_key: idempotencyKey,
      error_message: tgResult.error ?? null,
      sent_at: tgResult.ok ? nowIso : null,
    },
    { onConflict: "idempotency_key" },
  );

  if (!tgResult.ok) {
    return errorResponse(tgResult.error ?? "Failed to send test notification", 502);
  }

  return jsonResponse({
    success: true,
    sent_at: nowIso,
  });
});
