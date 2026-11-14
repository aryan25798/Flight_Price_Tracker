import { NextResponse } from "next/server";
import {
  buildPriceDropEmail,
  buildRoutineStatusUpdateEmail,
  buildTrackerCreatedEmail,
  sendEmail,
} from "@/lib/email/smtp";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const internalSecret = request.headers.get("x-internal-secret");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const cronSecret = process.env.CRON_SECRET;

    // Verify secret authentication
    const isAuthorized =
      (serviceKey && authHeader === `Bearer ${serviceKey}`) ||
      (cronSecret && internalSecret === cronSecret) ||
      (serviceKey && internalSecret === serviceKey);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, type, data } = body;

    if (!to || !type || !data) {
      return NextResponse.json(
        { error: "Missing required fields: to, type, data" },
        { status: 400 },
      );
    }

    let subject = "";
    let html = "";

    if (type === "price_drop") {
      subject = `🚨 Urgent Price Drop Alert: ${data.origin} → ${data.destination} (${data.currency} ${Number(data.currentPrice).toLocaleString()})`;
      html = buildPriceDropEmail({
        origin: data.origin,
        destination: data.destination,
        departureDate: data.departureDate,
        returnDate: data.returnDate,
        airline: data.airline,
        currentPrice: Number(data.currentPrice),
        targetPrice: Number(data.targetPrice),
        currency: data.currency,
        bookingUrl: data.bookingUrl,
      });
    } else if (type === "status_update") {
      subject = `⏱️ 4-Hour Flight Radar Update: ${data.origin} → ${data.destination} (${data.currency} ${Number(data.currentPrice).toLocaleString()})`;
      html = buildRoutineStatusUpdateEmail({
        origin: data.origin,
        destination: data.destination,
        departureDate: data.departureDate,
        returnDate: data.returnDate,
        airline: data.airline,
        currentPrice: Number(data.currentPrice),
        targetPrice: Number(data.targetPrice),
        currency: data.currency,
        bookingUrl: data.bookingUrl,
      });
    } else if (type === "tracker_created") {
      subject = `✈️ Radar Activated: ${data.origin} → ${data.destination} (${data.currency} ${Number(data.targetPrice).toLocaleString()})`;
      html = buildTrackerCreatedEmail({
        origin: data.origin,
        destination: data.destination,
        departureDate: data.departureDate,
        targetPrice: Number(data.targetPrice),
        currency: data.currency,
      });
    } else {
      subject = `✈️ AeroDrop Notification: ${data.origin} → ${data.destination}`;
      html = `<div style="font-family: sans-serif; padding: 20px;">${data.message || "AeroDrop system update"}</div>`;
    }

    const sent = await sendEmail({
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: sent });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
