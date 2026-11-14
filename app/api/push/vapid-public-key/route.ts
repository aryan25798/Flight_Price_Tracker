import { NextResponse } from "next/server";
import { FALLBACK_VAPID_PUBLIC_KEY } from "@/lib/push/server";

export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;
  return NextResponse.json({ publicKey });
}
