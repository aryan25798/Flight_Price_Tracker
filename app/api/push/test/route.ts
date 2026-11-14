import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/server";

export async function POST() {
  try {
    const { user } = await getAuthenticatedProfile();

    const result = await sendPushToUser(user.id, {
      title: "✈️ AeroDrop Push Connected!",
      body: "Native browser push notifications are active. You will receive live price alerts even when AeroDrop is in the background.",
      url: "/dashboard",
      icon: "/icons/icon-192.svg",
      tag: "aerodrop-test-push",
    });

    if (result.total === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No active browser push subscriptions found for this account. Please enable push notifications first.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Test push sent to ${result.sent} active device(s)!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication required";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
