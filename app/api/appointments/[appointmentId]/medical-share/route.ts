import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDICAL_FILE_BUCKET, medicalFileLimits } from "@/lib/medical-files/config";
import { validateMedicalFile } from "@/lib/medical-files/validation";
import { canManageAppointmentMedicalShare } from "@/lib/medical-files/authorization";
import type { AppointmentStatus } from "@/types";

export const runtime = "nodejs";

function responseError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await context.params;
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return responseError("Sign in before sharing medical files.", 401);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "patient") return responseError("Only the patient can share medical files.", 403);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return responseError("Secure medical-file storage is not configured.", 503);
  }

  const { data: appointment, error: appointmentError } = await admin.from("appointments").select("id, patient_id, doctor_id, status, ends_at").eq("id", appointmentId).maybeSingle();
  if (appointmentError || !appointment) return responseError("The appointment was not found.", 404);
  if (!canManageAppointmentMedicalShare({ userId: user.id, role: "patient", patientId: appointment.patient_id, appointmentStatus: appointment.status as AppointmentStatus })) return responseError("You cannot share files for this appointment.", 403);

  const formData = await request.formData();
  const summary = formData.get("summary");
  const supporting = formData.getAll("documents");
  const submitted = [
    ...(summary instanceof File && summary.size > 0 ? [{ file: summary, kind: "medical_summary" as const }] : []),
    ...supporting.flatMap((value) => value instanceof File && value.size > 0 ? [{ file: value, kind: "supporting" as const }] : []),
  ];
  const limits = medicalFileLimits();
  if (submitted.length < 1) return responseError("Choose your medical summary or at least one supporting file.", 400);
  if (submitted.length > limits.maxFiles) return responseError(`Choose no more than ${limits.maxFiles} files.`, 400);

  let validated: Array<Awaited<ReturnType<typeof validateMedicalFile>> & { kind: "medical_summary" | "supporting" }>;
  try {
    validated = await Promise.all(submitted.map(async ({ file, kind }) => ({ ...(await validateMedicalFile(file, limits.maxBytes)), kind })));
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "A medical file could not be validated.", 400);
  }

  const { data: share, error: shareError } = await admin.from("appointment_medical_shares").insert({ appointment_id: appointmentId }).select("id, appointment_id, expires_at, created_at").single();
  if (shareError || !share) return responseError(shareError?.message ?? "A secure share could not be created.", 400);

  const fileRows = validated.map((file) => {
    const id = crypto.randomUUID();
    return {
      id,
      share_id: share.id,
      storage_reference: `share/${share.id}/${id}`,
      original_filename: file.originalFilename,
      mime_type: file.mimeType,
      size_bytes: file.size,
      content_sha256: file.sha256,
      kind: file.kind,
      upload_status: "pending",
    };
  });
  const uploadedPaths: string[] = [];

  try {
    const { error: metadataError } = await admin.from("appointment_medical_files").insert(fileRows);
    if (metadataError) throw metadataError;

    for (let index = 0; index < validated.length; index += 1) {
      const file = validated[index];
      const row = fileRows[index];
      const { error: uploadError } = await admin.storage.from(MEDICAL_FILE_BUCKET).upload(row.storage_reference, file.bytes, { contentType: file.mimeType, upsert: false, cacheControl: "0" });
      if (uploadError) throw uploadError;
      uploadedPaths.push(row.storage_reference);
    }

    const { error: readyError } = await admin.from("appointment_medical_files").update({ upload_status: "ready" }).in("id", fileRows.map((row) => row.id));
    if (readyError) throw readyError;

    await admin.from("appointment_medical_shares").update({ revoked_at: new Date().toISOString() }).eq("appointment_id", appointmentId).neq("id", share.id).is("revoked_at", null);
  } catch {
    if (uploadedPaths.length > 0) await admin.storage.from(MEDICAL_FILE_BUCKET).remove(uploadedPaths);
    await admin.from("appointment_medical_shares").delete().eq("id", share.id);
    return responseError("The files were not shared. No partial share was kept.", 500);
  }

  return NextResponse.json({
    ok: true,
    share: {
      id: share.id,
      appointment_id: share.appointment_id,
      expires_at: share.expires_at,
      created_at: share.created_at,
      files: fileRows.map((row) => ({ id: row.id, original_filename: row.original_filename, mime_type: row.mime_type, size_bytes: row.size_bytes, kind: row.kind })),
    },
  }, { status: 201 });
}
