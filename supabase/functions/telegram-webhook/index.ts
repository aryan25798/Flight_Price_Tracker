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
      "",
      "Commands available:",
      "• <code>/mytrackers</code> — View your active flight trackers",
      "• <code>/mydeals</code> — View flights pricing below target",
      "• <code>/help</code> — Full command menu",
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

  // Verify that the Telegram chatId is linked to an active user profile
  const supabaseAdmin = createServiceClient();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, is_banned, tier")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!profile || profile.is_banned) {
    await sendTelegramMessage(
      chatId,
      "✈️ <b>AeroDrop Flight Radar Bot</b>\n\nYour Telegram account is not linked to an active AeroDrop profile. Please open your web dashboard settings and click <b>Link Telegram</b> to connect.",
    );
    return jsonResponse({ ok: true });
  }

  // Deterministic command: /mytrackers
  if (text === "/mytrackers" || text === "/trackers") {
    const { data: trackers } = await supabaseAdmin
      .from("tracked_flights")
      .select("origin, destination, departure_date, currency, target_price, last_seen_price, is_active")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!trackers || trackers.length === 0) {
      await sendTelegramMessage(
        chatId,
        "✈️ <b>Your Trackers</b>\n\nYou have no flight trackers configured. Add one from your AeroDrop dashboard!",
      );
      return jsonResponse({ ok: true });
    }

    const lines = ["✈️ <b>Your Active Flight Trackers:</b>", ""];
    for (const t of trackers) {
      const statusIcon = t.is_active ? "🟢" : "⏸️";
      const current = t.last_seen_price ? `${t.currency} ${Number(t.last_seen_price).toLocaleString()}` : "Monitoring";
      lines.push(`${statusIcon} <b>${t.origin} → ${t.destination}</b> (${t.departure_date})`);
      lines.push(`   Target: ${t.currency} ${Number(t.target_price).toLocaleString()} · Current: ${current}`);
      lines.push("");
    }
    await sendTelegramMessage(chatId, lines.join("\n"));
    return jsonResponse({ ok: true });
  }

  // Deterministic command: /mydeals or /mysavings
  if (text === "/mydeals" || text === "/mysavings" || text === "/deals") {
    const { data: deals } = await supabaseAdmin
      .from("tracked_flights")
      .select("origin, destination, departure_date, currency, target_price, last_seen_price")
      .eq("user_id", profile.id)
      .eq("is_active", true)
      .not("last_seen_price", "is", null);

    const winningDeals = (deals ?? []).filter((d) => d.last_seen_price && d.last_seen_price <= d.target_price);

    if (winningDeals.length === 0) {
      await sendTelegramMessage(
        chatId,
        "🎯 <b>Price Target Status</b>\n\nNone of your tracked flights are currently below target prices. Our 4-hour radar will alert you the moment a fare drops!",
      );
      return jsonResponse({ ok: true });
    }

    const lines = ["🔥 <b>Price Drops Meeting Your Target:</b>", ""];
    for (const d of winningDeals) {
      const savings = d.target_price - d.last_seen_price!;
      lines.push(`⚡ <b>${d.origin} → ${d.destination}</b> (${d.departure_date})`);
      lines.push(`   Current: <b>${d.currency} ${Number(d.last_seen_price).toLocaleString()}</b> (Saved ${d.currency} ${Number(savings).toLocaleString()})`);
      lines.push("");
    }
    await sendTelegramMessage(chatId, lines.join("\n"));
    return jsonResponse({ ok: true });
  }

  // Help command
  if (text === "/help") {
    const helpText = [
      "✈️ <b>AeroDrop AI Bot Commands</b>",
      "",
      "• <code>/mytrackers</code> — View all active radar trackers",
      "• <code>/mydeals</code> — View flights currently below your target price",
      "• <code>/mysavings</code> — Summary of verified fare discounts",
      "• <code>/help</code> — Show this commands menu",
      "",
      "💡 <i>You can also ask natural-language questions, like:</i>",
      "• <i>'What is my cheapest flight right now?'</i>",
      "• <i>'Did any prices drop today?'</i>",
    ].join("\n");
    await sendTelegramMessage(chatId, helpText);
    return jsonResponse({ ok: true });
  }

  // Natural Language Query via Google Gemini (Free Tier)
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiApiKey) {
    try {
      const { data: trackers } = await supabaseAdmin
        .from("tracked_flights")
        .select("origin, destination, departure_date, currency, target_price, last_seen_price, is_active")
        .eq("user_id", profile.id)
        .limit(6);

      const trackersSummary = JSON.stringify(trackers ?? []);

      const prompt = `You are AeroDrop Telegram Flight Assistant. Ground every answer strictly in the user's verified flight trackers: ${trackersSummary}.
User question: "${text.replace(/"/g, "'")}".
Answer in concise, helpful Telegram HTML formatting (max 100 words). If the user asks about an unknown route, instruct them to add it from the web dashboard.`;

      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
          }),
        },
      );

      const aiData = await aiRes.json();
      const reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        await sendTelegramMessage(chatId, reply);
        return jsonResponse({ ok: true });
      }
    } catch (e) {
      console.warn("Telegram AI inference error:", e);
    }
  }

  await sendTelegramMessage(
    chatId,
    "✈️ Manage your flight price trackers in the web dashboard. Use /mytrackers, /mydeals, or /help to interact with the bot.",
  );
  return jsonResponse({ ok: true });
});
