"use client";
import { AlertTriangle, Phone } from "lucide-react";
import { contacts } from "@/mock-data";
import type { Contact } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export function EmergencyModal({ open, onClose, onCall }: { open: boolean; onClose: () => void; onCall: (contact: Contact) => void }) {
  const { t, language } = useApp();
  return <Modal open={open} onOpenChange={(value) => { if (!value) onClose(); }} title={t("emergencyHelp")} description={language === "ne" ? "तपाईं कसलाई सम्पर्क गर्न चाहनुहुन्छ?" : "Who would you like to contact?"} className="border-red-200"><div className="mb-5 flex gap-3 rounded-2xl bg-red-50 p-4 text-red-900"><AlertTriangle className="h-6 w-6 shrink-0" /><p className="text-sm font-semibold">Demonstration only. These are mock phone numbers and no call starts automatically.</p></div><div className="space-y-3">{contacts.map((contact) => <Button key={contact.id} variant={contact.type === "emergency" ? "danger" : "secondary"} size="large" className="w-full justify-start" onClick={() => { onClose(); onCall(contact); }}><Phone className="shrink-0" /><span className="text-start"><span className="block">{contact.name}</span><span className="block text-sm font-medium opacity-75">{contact.role}</span></span></Button>)}</div></Modal>;
}
