"use client";
import { useState } from "react";
import type { Contact } from "@/types";
import { contacts } from "@/mock-data";
import { useApp } from "@/components/providers/AppProvider";
import { ContactCard } from "./ContactCard";
import { CallConfirmationModal } from "./CallConfirmationModal";
import { EmergencyButton } from "./EmergencyButton";

export function ContactsSection({ compact = false }: { compact?: boolean }) {
  const { t } = useApp(); const [selected, setSelected] = useState<Contact | null>(null);
  const regular = contacts.filter((contact) => contact.type !== "emergency");
  return <section id="contacts" className="scroll-mt-28"><div className="mb-5"><p className="eyebrow">{t("quickContact")}</p><h2 className="section-title mt-1">{t("contacts")}</h2></div><div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-3"}`}>{regular.map((contact) => <ContactCard key={contact.id} contact={contact} onCall={setSelected} compact={compact} />)}</div><div className="mt-5"><EmergencyButton onCall={setSelected} /></div><CallConfirmationModal contact={selected} onClose={() => setSelected(null)} /></section>;
}
