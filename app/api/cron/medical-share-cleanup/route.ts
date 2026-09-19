import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDICAL_FILE_BUCKET } from "@/lib/medical-files/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    // Completed shares remain as audit records. Only shares that still have
    // files should occupy the bounded cleanup batch on later runs.
    const [{ data: expired, error: expiredError }, { data: revoked, error: revokedError }] = await Promise.all([
      admin.from("appointment_medical_shares").select("id, revoked_at, appointment_medical_files!inner(id)").lte("expires_at", now).limit(100),
      admin.from("appointment_medical_shares").select("id, revoked_at, appointment_medical_files!inner(id)").not("revoked_at", "is", null).limit(100),
    ]);
    if (expiredError || revokedError) throw new Error("Cleanup lookup failed.");
    const shares = Array.from(new Map([...(expired ?? []), ...(revoked ?? [])].map((share) => [share.id, share])).values());
    let cleanedFiles = 0;

    for (const share of shares) {
      const { data: files, error: filesError } = await admin.from("appointment_medical_files").select("id, storage_reference").eq("share_id", share.id);
      if (filesError) throw new Error("Cleanup file lookup failed.");
      if ((files ?? []).length > 0) {
        const { error: storageError } = await admin.storage.from(MEDICAL_FILE_BUCKET).remove((files ?? []).map((file) => file.storage_reference));
        if (storageError) continue;
        const { error: deleteError } = await admin.from("appointment_medical_files").delete().eq("share_id", share.id);
        if (deleteError) throw new Error("Cleanup metadata removal failed.");
        cleanedFiles += files?.length ?? 0;
      }
      if (!share.revoked_at) {
        const { error: revokeError } = await admin.from("appointment_medical_shares").update({ revoked_at: now }).eq("id", share.id);
        if (revokeError) throw new Error("Cleanup revocation failed.");
      }
    }

    return NextResponse.json({ ok: true, processedShares: shares.length, cleanedFiles });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
