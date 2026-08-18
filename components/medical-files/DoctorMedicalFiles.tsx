"use client";

import { useState } from "react";
import { Eye, FileHeart, ShieldCheck } from "lucide-react";
import type { AppointmentMedicalShare } from "@/types";
import { SecureDocumentViewer } from "@/components/medical-files/SecureDocumentViewer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApp } from "@/components/providers/AppProvider";

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function DoctorMedicalFiles({ share }: { share: AppointmentMedicalShare }) {
  const { t } = useApp();
  const [selectedId, setSelectedId] = useState(share.files[0]?.id ?? null);
  const selected = share.files.find((file) => file.id === selectedId) ?? null;
  return <div className="space-y-6"><Card className="p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-primary" /><div><h2 className="text-xl font-extrabold">{t("temporaryDocuments")}</h2><p className="mt-1 text-muted">{t("temporaryDocumentsHelp")}</p></div></div></Card><div className="grid gap-6 xl:grid-cols-[360px_1fr]"><Card className="h-fit p-4"><p className="eyebrow">{t("sharedFiles")}</p><div className="mt-3 space-y-2">{share.files.map((file) => <Button key={file.id} type="button" variant={selectedId === file.id ? "primary" : "secondary"} className="h-auto min-h-16 w-full justify-start px-4 py-3 text-left" onClick={() => setSelectedId(file.id)}><FileHeart className="shrink-0" /><span className="min-w-0"><span className="block truncate">{file.kind === "medical_summary" ? t("medicalSummary") : file.original_filename}</span><span className="block text-xs font-semibold opacity-75">{formatBytes(file.size_bytes)}</span></span></Button>)}</div></Card><Card className="p-4 md:p-6">{selected ? <><div className="mb-4 flex items-center gap-2"><Eye className="text-primary" /><h3 className="truncate text-lg font-extrabold">{selected.kind === "medical_summary" ? t("saharaMedicalSummary") : selected.original_filename}</h3></div><SecureDocumentViewer url={`/api/medical-shares/${share.id}/files/${selected.id}/view`} mimeType={selected.mime_type} label={t("patientSharedDocument")} /></> : <p className="py-12 text-center text-muted">{t("noViewableFiles")}</p>}</Card></div></div>;
}
