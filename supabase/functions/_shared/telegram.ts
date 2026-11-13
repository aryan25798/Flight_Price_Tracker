export interface TelegramSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${Math.round(amount).toLocaleString()}`;
  }
}

export function formatDateReadable(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildComparisonUrls(origin: string, destination: string, departureDate: string, returnDate?: string | null) {
  const orig = origin.toUpperCase();
  const dest = destination.toUpperCase();
  
  const googleQuery = returnDate
    ? `Flights to ${dest} from ${orig} on ${departureDate} through ${returnDate}`
    : `Flights to ${dest} from ${orig} on ${departureDate}`;
  const googleUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(googleQuery)}`;

  const depYYMMDD = departureDate ? departureDate.slice(2).replace(/-/g, "") : "";
  const skyscannerUrl = `https://www.skyscanner.co.in/transport/flights/${orig.toLowerCase()}/${dest.toLowerCase()}/${depYYMMDD}/`;

  const [depY, depM, depD] = (departureDate || "").split("-");
  const mmtDepDate = depD && depM && depY ? `${depD}/${depM}/${depY}` : departureDate;
  const mmtUrl = `https://www.makemytrip.com/flight/search?itinerary=${orig}-${dest}-${mmtDepDate}&tripType=${returnDate ? "R" : "O"}&paxType=A-1_C-0_I-0&intl=false&cabinClass=E`;

  return { googleUrl, skyscannerUrl, mmtUrl };
}

export interface PriceDropMessageParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  airline?: string | null;
  previousPrice?: number | null;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  bookingUrl?: string | null;
}

/**
 * Urgent High-Priority Alert when fares drop below user target price
 */
export function formatPriceDropMessage(params: PriceDropMessageParams): string {
  const formattedCurrent = formatCurrency(params.currentPrice, params.currency);
  const formattedTarget = formatCurrency(params.targetPrice, params.currency);
  const { googleUrl, skyscannerUrl, mmtUrl } = buildComparisonUrls(
    params.origin,
    params.destination,
    params.departureDate,
    params.returnDate,
  );

  const lines: string[] = [
    "🚨 <b>HURRY UP! PRICE DROP ALERT!</b> 🚨",
    "",
    "⚡ <b>HURRY! Flight price is now LESS than your target price!</b> Book immediately before fares rebound or seats sell out.",
    "",
    `✈️ <b>Route:</b> ${escapeHtml(params.origin)} → ${escapeHtml(params.destination)}`,
    `📅 <b>Departure:</b> ${escapeHtml(formatDateReadable(params.departureDate))}`,
  ];

  if (params.returnDate) {
    lines.push(`🔄 <b>Return:</b> ${escapeHtml(formatDateReadable(params.returnDate))}`);
  }

  if (params.airline) {
    lines.push(`🛫 <b>Airline:</b> ${escapeHtml(params.airline)}`);
  }

  lines.push(`💰 <b>Current Lowest Price:</b> <b>${escapeHtml(formattedCurrent)}</b> 🔥`);
  lines.push(`🎯 <b>Your Target Alert:</b> ${escapeHtml(formattedTarget)}`);

  if (params.currentPrice < params.targetPrice) {
    const savings = params.targetPrice - params.currentPrice;
    const pct = Math.round((savings / params.targetPrice) * 100);
    lines.push(`💵 <b>Below Target By:</b> <b>${escapeHtml(formatCurrency(savings, params.currency))}</b> (${pct}% discount)`);
  }

  if (params.previousPrice && params.previousPrice > params.currentPrice) {
    const drop = params.previousPrice - params.currentPrice;
    lines.push(`📉 <b>Recent Drop:</b> -${escapeHtml(formatCurrency(drop, params.currency))} from previous check`);
  }

  lines.push("");
  if (params.bookingUrl && params.bookingUrl.startsWith("https://")) {
    lines.push(`👉 <a href="${escapeHtml(params.bookingUrl)}"><b>BOOK LOWEST FARE NOW</b></a>`);
  }

  lines.push("");
  lines.push("🌐 <b>Compare Across Other Top Sites:</b>");
  lines.push(`• <a href="${escapeHtml(googleUrl)}">Google Flights</a>`);
  lines.push(`• <a href="${escapeHtml(skyscannerUrl)}">Skyscanner</a>`);
  lines.push(`• <a href="${escapeHtml(mmtUrl)}">MakeMyTrip</a>`);

  return lines.join("\n");
}

export interface RoutineUpdateMessageParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  airline?: string | null;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  bookingUrl?: string | null;
}

/**
 * Periodic 4-Hour Heartbeat Status Update even when no price drop below target
 */
export function formatRoutineUpdateMessage(params: RoutineUpdateMessageParams): string {
  const formattedCurrent = formatCurrency(params.currentPrice, params.currency);
  const formattedTarget = formatCurrency(params.targetPrice, params.currency);
  const diff = params.currentPrice - params.targetPrice;
  const { googleUrl, skyscannerUrl, mmtUrl } = buildComparisonUrls(
    params.origin,
    params.destination,
    params.departureDate,
    params.returnDate,
  );

  const lines: string[] = [
    "⏱️ <b>4-HOUR FLIGHT MONITORING UPDATE</b>",
    "",
    "AeroDrop is actively tracking your flight route across 100+ airlines & booking providers.",
    "",
    `✈️ <b>Route:</b> ${escapeHtml(params.origin)} → ${escapeHtml(params.destination)}`,
    `📅 <b>Departure:</b> ${escapeHtml(formatDateReadable(params.departureDate))}`,
  ];

  if (params.returnDate) {
    lines.push(`🔄 <b>Return:</b> ${escapeHtml(formatDateReadable(params.returnDate))}`);
  }

  if (params.airline) {
    lines.push(`🛫 <b>Current Airline:</b> ${escapeHtml(params.airline)}`);
  }

  lines.push(`💰 <b>Current Lowest Rate:</b> ${escapeHtml(formattedCurrent)}`);
  lines.push(`🎯 <b>Target Alert Price:</b> ${escapeHtml(formattedTarget)}`);

  if (diff > 0) {
    lines.push(`📊 <b>Status:</b> Currently ${escapeHtml(formatCurrency(diff, params.currency))} above your target. We will alert you immediately the moment it drops!`);
  } else {
    lines.push(`📊 <b>Status:</b> Price is at or below target!`);
  }

  if (params.bookingUrl && params.bookingUrl.startsWith("https://")) {
    lines.push("");
    lines.push(`🛒 <a href="${escapeHtml(params.bookingUrl)}">View Current Flight Details</a>`);
  }

  lines.push("");
  lines.push("🌐 <b>Compare Live Rates Across Sites:</b>");
  lines.push(`• <a href="${escapeHtml(googleUrl)}">Google Flights</a>`);
  lines.push(`• <a href="${escapeHtml(skyscannerUrl)}">Skyscanner</a>`);
  lines.push(`• <a href="${escapeHtml(mmtUrl)}">MakeMyTrip</a>`);

  return lines.join("\n");
}

export async function sendTelegramMessage(
  chatId: string,
  htmlText: string,
  timeoutMs = 8000,
): Promise<TelegramSendResult> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        statusCode: response.status,
        error: payload?.description || `Telegram HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      messageId: payload?.result?.message_id
        ? String(payload.result.message_id)
        : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Telegram request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
