"use client";
import { useState } from "react";
import { Siren } from "lucide-react";
import type { Contact } from "@/types";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";
import { EmergencyModal } from "./EmergencyModal";

export function EmergencyButton({ onCall }: { onCall: (contact: Contact) => void }) {
  const [open, setOpen] = useState(false); const { t } = useApp();
  return <><Button variant="danger" size="large" className="w-full min-h-20 text-xl" onClick={() => setOpen(true)}><Siren className="h-7 w-7" />{t("emergencyHelp")}</Button><EmergencyModal open={open} onClose={() => setOpen(false)} onCall={onCall} /></>;
}
