"use client";
import { Phone, ShieldCheck } from "lucide-react";
import type { Contact } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export function CallConfirmationModal({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const { t } = useApp();
  return <Modal open={Boolean(contact)} onOpenChange={(open) => { if (!open) onClose(); }} title={t("confirmCall")} description={t("demoNotice")}><div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-800"><p className="text-xl font-extrabold">{contact?.name}</p><p className="mt-1 font-semibold text-muted">{contact?.role}</p><p className="mt-3 font-bold">{contact?.phone}</p></div><p className="mt-4 flex items-start gap-2 text-sm text-muted"><ShieldCheck className="h-5 w-5 shrink-0 text-success" />All numbers are mock demonstration data.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button variant="secondary" size="large" onClick={onClose}>{t("cancel")}</Button><Button asChild size="large"><a href={`tel:${contact?.phone}`} onClick={onClose}><Phone />{t("callNow")}</a></Button></div></Modal>;
}
