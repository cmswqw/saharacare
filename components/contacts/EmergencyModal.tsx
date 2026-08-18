"use client";
import { AlertTriangle, Phone } from "lucide-react";
import { contacts } from "@/mock-data";
import type { Contact } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey } from "@/lib/i18n";

const roleKeys: Record<Contact["type"], TranslationKey> = { caregiver: "caregiver", doctor: "doctor", hospital: "hospital", emergency: "emergencyContact" };

export function EmergencyModal({ open, onClose, onCall }: { open: boolean; onClose: () => void; onCall: (contact: Contact) => void }) {
  const { t } = useApp();
  return <Modal open={open} onOpenChange={(value) => { if (!value) onClose(); }} title={t("emergencyHelp")} description={t("whoToContact")} className="border-red-200"><div className="mb-5 flex gap-3 rounded-2xl bg-red-50 p-4 text-red-900"><AlertTriangle className="h-6 w-6 shrink-0" /><p className="text-sm font-semibold">{t("emergencyDemoNotice")}</p></div><div className="space-y-3">{contacts.map((contact) => <Button key={contact.id} variant={contact.type === "emergency" ? "danger" : "secondary"} size="large" className="w-full justify-start" onClick={() => { onClose(); onCall(contact); }}><Phone className="shrink-0" /><span className="text-start"><span className="block">{contact.name}</span><span className="block text-sm font-medium opacity-75">{t(roleKeys[contact.type])}</span></span></Button>)}</div></Modal>;
}
