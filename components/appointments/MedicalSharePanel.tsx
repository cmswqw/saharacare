"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FileHeart, FilePlus2, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useMedicalKyc } from "@/components/providers/MedicalKycProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey, TranslationValues } from "@/lib/i18n";
import type { Appointment, AppointmentMedicalShare } from "@/types";
import { getAppointmentPurposeKey } from "@/lib/appointment-utils";

const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;
const maxFiles = 6;

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function appointmentDate(iso: string, language: "en" | "ne") {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", { timeZone: "Asia/Kathmandu", dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
}

type ShareMessage = {
  tone: "success" | "error";
  key: TranslationKey;
  values?: TranslationValues;
};

export function MedicalSharePanel({ appointment, share }: { appointment: Appointment; share: AppointmentMedicalShare | null }) {
  const router = useRouter();
  const { language, t } = useApp();
  const { generatedSummary } = useMedicalKyc();
  const [includeSummary, setIncludeSummary] = useState(Boolean(generatedSummary));
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState<ShareMessage | null>(null);
  const purposeKey = getAppointmentPurposeKey(appointment.purpose);
  const activeShare = Boolean(share && !share.revoked_at && new Date(share.expires_at).getTime() > Date.now() && appointment.status !== "cancelled");
  const selectedCount = files.length + (includeSummary && generatedSummary ? 1 : 0);
  const selected = useMemo(() => [
    ...(includeSummary && generatedSummary ? [generatedSummary.file] : []),
    ...files,
  ], [files, generatedSummary, includeSummary]);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setMessage(null);
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!acceptedTypes.has(file.type)) {
        setMessage({ tone: "error", key: "invalidFileType", values: { name: file.name } });
        continue;
      }
      if (file.size < 1 || file.size > maxBytes) {
        setMessage({ tone: "error", key: "fileTooLarge", values: { name: file.name } });
        continue;
      }
      if (next.length + (includeSummary && generatedSummary ? 1 : 0) >= maxFiles) {
        setMessage({ tone: "error", key: "tooManyFiles", values: { count: maxFiles } });
        break;
      }
      next.push(file);
    }
    setFiles(next);
  }

  async function shareFiles() {
    if (selectedCount < 1) {
      setMessage({ tone: "error", key: "chooseShareFile" });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const formData = new FormData();
    if (includeSummary && generatedSummary) formData.set("summary", generatedSummary.file);
    files.forEach((file) => formData.append("documents", file));
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/medical-share`, { method: "POST", body: formData });
      const body = await response.json() as { ok: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "share_failed");
      setMessage({ tone: "success", key: "shareSucceeded" });
      setFiles([]);
      router.refresh();
    } catch {
      setMessage({ tone: "error", key: "shareFailed" });
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeShare() {
    if (!share) return;
    setRevoking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/medical-shares/${share.id}`, { method: "DELETE" });
      const body = await response.json() as { ok: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "revoke_failed");
      setMessage({ tone: "success", key: "revokeSucceeded" });
      router.refresh();
    } catch {
      setMessage({ tone: "error", key: "revokeFailed" });
    } finally {
      setRevoking(false);
    }
  }

  return <div className="space-y-6"><Card className="p-5 md:p-6"><p className="eyebrow">{t("appointmentScopedSharing")}</p><h2 className="section-title mt-1">{t("chooseDoctorView", { doctor: appointment.doctor_name })}</h2><div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/40"><p className="font-bold">{appointmentDate(appointment.starts_at, language)}</p><p className="mt-1 text-muted">{appointment.facility} - {purposeKey ? t(purposeKey) : appointment.purpose}</p></div><div className="mt-5 flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100"><ShieldCheck className="mt-0.5 shrink-0" /><p>{t("sharePrivacyNotice")}</p></div></Card>

    {share ? <Card className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{t("currentShare")}</p><h3 className="mt-1 text-xl font-extrabold">{t(activeShare ? "active" : share.revoked_at ? "revoked" : "expired")}</h3><p className="mt-2 text-muted">{t("expiresAt", { date: appointmentDate(share.expires_at, language) })}</p></div>{activeShare ? <Button type="button" variant="danger" disabled={revoking} onClick={revokeShare}><Trash2 />{t(revoking ? "revoking" : "revokeAccess")}</Button> : null}</div><ul className="mt-4 space-y-2">{share.files.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40"><span className="min-w-0 truncate font-bold">{file.kind === "medical_summary" ? t("medicalSummaryPrefix") : ""}{file.original_filename}</span><span className="shrink-0 text-sm text-muted">{formatBytes(file.size_bytes)}</span></li>)}</ul></Card> : null}

    {appointment.status === "cancelled" ? <Card className="border-amber-200 bg-amber-50 p-5 font-bold text-amber-900">{t("cancelledShareNotice")}</Card> : <Card className="p-5 md:p-6"><h3 className="text-xl font-extrabold">{t("createSecureShare")}</h3><p className="mt-2 text-muted">{t("newShareRevokes")}</p><div className="mt-5 space-y-4">
      <label className={`flex min-h-20 items-center gap-4 rounded-2xl border-2 p-4 ${generatedSummary && includeSummary ? "border-primary bg-blue-50 dark:bg-blue-950/40" : "bg-card"}`}><input type="checkbox" checked={Boolean(generatedSummary && includeSummary)} disabled={!generatedSummary} onChange={(event) => setIncludeSummary(event.target.checked)} /><FileHeart className="shrink-0 text-primary" /><span><span className="block font-extrabold">{t("includeMedicalSummary")}</span><span className="block text-sm text-muted">{generatedSummary ? generatedSummary.file.name : t("createReviewSummaryFirst")}</span></span></label>
      {!generatedSummary ? <Button asChild variant="secondary"><Link href="/patient/medical-information">{t("createMedicalSummary")}</Link></Button> : null}
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 bg-card px-4 font-extrabold hover:border-primary/50"><Camera />{t("takePhoto")}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /></label><label className="flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 bg-card px-4 font-extrabold hover:border-primary/50"><FilePlus2 />{t("chooseFiles")}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /></label></div>
      {selected.length > 0 ? <div><p className="mb-2 font-extrabold">{t("filesSelected", { selected: selectedCount, maximum: maxFiles })}</p><ul className="space-y-2">{selected.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40"><span className="min-w-0 truncate font-bold">{file.name}</span><span className="shrink-0 text-sm text-muted">{formatBytes(file.size)}</span></li>)}</ul></div> : null}
      {message ? <p role="status" className={`rounded-2xl p-4 font-bold ${message.tone === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{t(message.key, message.values)}</p> : null}
      <Button type="button" size="large" className="w-full" disabled={submitting || selectedCount < 1} onClick={shareFiles}>{submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}{t(submitting ? "sharingSecurely" : "shareWithDoctor")}</Button>
    </div></Card>}
  </div>;
}
