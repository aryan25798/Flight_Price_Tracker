import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Confirmation text 'DELETE' is required to permanently delete your account." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 1. Explicitly clean up any push subscriptions for this user
    await admin.from("push_subscriptions").delete().eq("user_id", user.id);

    // 2. Delete from profiles (cascades to tracked_flights, notification_logs, ai_conversations, etc.)
    const { error: profileDeleteError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileDeleteError) {
      console.error("Failed to delete user profile records:", profileDeleteError);
      return NextResponse.json(
        { error: "Failed to erase account records. Please contact support." },
        { status: 500 },
      );
    }

    // 3. Delete from auth.users
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      console.error("Failed to delete auth user:", authDeleteError);
      return NextResponse.json(
        { error: "Failed to complete account deletion from identity provider." },
        { status: 500 },
      );
    }

    // 4. Terminate session
    await supabase.auth.signOut();

    return NextResponse.json({
      ok: true,
      message: "Your account and all associated flight tracking data have been permanently erased.",
    });
  } catch (err: unknown) {
    console.error("Account deletion unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during account deletion." },
      { status: 500 },
    );
  }
}
