import { NextResponse } from "next/server";
import {
  isSameOriginMutation,
  parsePushEndpoint,
  parsePushSubscriptionInput,
} from "@/lib/notifications/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedPatient() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { userId: null, status: 401 };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "patient" || profile.account_status !== "active") {
    return { userId: null, status: 403 };
  }

  return { userId: user.id, status: 200 };
}

function denied(status: number) {
  return NextResponse.json({ ok: false }, { status });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return denied(403);
  const patient = await authenticatedPatient();
  if (!patient.userId) return denied(patient.status);

  const input = parsePushSubscriptionInput(await request.json().catch(() => null));
  if (!input) return denied(400);

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", input.endpoint)
    .maybeSingle();

  if (lookupError) return denied(500);
  if (existing && existing.user_id !== patient.userId) return denied(409);

  const values = {
    user_id: patient.userId,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth_key: input.keys.auth,
    language: input.language,
    sound_enabled: input.soundEnabled,
    disabled_at: null,
    last_seen_at: new Date().toISOString(),
  };
  const mutation = existing
    ? admin.from("push_subscriptions").update(values).eq("id", existing.id)
    : admin.from("push_subscriptions").insert(values);
  const { error: mutationError } = await mutation;

  if (mutationError) return denied(500);
  return NextResponse.json({ ok: true, enabled: true });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return denied(403);
  const patient = await authenticatedPatient();
  if (!patient.userId) return denied(patient.status);

  const endpoint = parsePushEndpoint(await request.json().catch(() => null));
  if (!endpoint) return denied(400);

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", patient.userId)
    .eq("endpoint", endpoint);

  if (error) return denied(500);
  return NextResponse.json({ ok: true, enabled: false });
}
