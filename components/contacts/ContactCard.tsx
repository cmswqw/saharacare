"use client";
import { Building2, HeartHandshake, Phone, Stethoscope } from "lucide-react";
import type { Contact } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey } from "@/lib/i18n";

const icons = { caregiver: HeartHandshake, doctor: Stethoscope, hospital: Building2, emergency: Phone };
const roleKeys: Record<Contact["type"], TranslationKey> = { caregiver: "caregiver", doctor: "doctor", hospital: "hospital", emergency: "emergencyContact" };

export function ContactCard({ contact, onCall, compact = false }: { contact: Contact; onCall: (contact: Contact) => void; compact?: boolean }) {
  const { t } = useApp();
  const Icon = icons[contact.type];
  return <Card className={`flex ${compact ? "items-center p-4" : "flex-col p-5"} gap-4`}><span className={`${compact ? "h-12 w-12" : "h-14 w-14"} grid shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/50`}><Icon aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-lg font-extrabold">{contact.name}</p><p className="mt-1 text-base text-muted">{t(roleKeys[contact.type])}</p></div><Button variant="secondary" size={compact ? "icon" : "large"} className={compact ? "shrink-0" : "mt-auto w-full"} onClick={() => onCall(contact)} aria-label={t("callContact", { name: contact.name })}><Phone />{compact ? null : t("call")}</Button></Card>;
}
