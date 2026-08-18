import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDICAL_FILE_BUCKET } from "@/lib/medical-files/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validSecret(request: Request) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function GET(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const [{ data: expired }, { data: revoked }] = await Promise.all([
      admin.from("appointment_medical_shares").select("id, revoked_at").lte("expires_at", now).limit(100),
      admin.from("appointment_medical_shares").select("id, revoked_at").not("revoked_at", "is", null).limit(100),
    ]);
    const shares = Array.from(new Map([...(expired ?? []), ...(revoked ?? [])].map((share) => [share.id, share])).values());
    let cleanedFiles = 0;

    for (const share of shares) {
      const { data: files } = await admin.from("appointment_medical_files").select("id, storage_reference").eq("share_id", share.id);
      if ((files ?? []).length > 0) {
        const { error: storageError } = await admin.storage.from(MEDICAL_FILE_BUCKET).remove((files ?? []).map((file) => file.storage_reference));
        if (storageError) continue;
        await admin.from("appointment_medical_files").delete().eq("share_id", share.id);
        cleanedFiles += files?.length ?? 0;
      }
      if (!share.revoked_at) await admin.from("appointment_medical_shares").update({ revoked_at: now }).eq("id", share.id);
    }

    return NextResponse.json({ ok: true, processedShares: shares.length, cleanedFiles });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
