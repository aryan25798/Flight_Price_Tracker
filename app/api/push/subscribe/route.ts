import { NextResponse } from "next/server";
import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedProfile();
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get("user-agent") || null;
    const supabase = await createClient();

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication required";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await getAuthenticatedProfile();
    const body = await request.json().catch(() => ({}));
    const { endpoint } = body;

    const supabase = await createClient();
    let query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);

    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication required";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
