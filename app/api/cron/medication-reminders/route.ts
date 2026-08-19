import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron";
import { dispatchMedicationReminders } from "@/lib/notifications/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await dispatchMedicationReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(JSON.stringify({
      event: "medication_reminder_cron_failed",
      error: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown medication reminder error",
    }));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
