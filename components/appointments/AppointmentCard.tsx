"use client";

import Link from "next/link";
import { CalendarDays, Clock3, FileHeart, Stethoscope, UserRound } from "lucide-react";
import type { Appointment } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useApp } from "@/components/providers/AppProvider";
import type { Language } from "@/types";
import { getAppointmentPurposeKey } from "@/lib/appointment-utils";

function appointmentDate(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", { timeZone: "Asia/Kathmandu", dateStyle: "long" }).format(new Date(iso));
}

function appointmentTime(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", { timeZone: "Asia/Kathmandu", timeStyle: "short" }).format(new Date(iso));
}

export function AppointmentCard({ appointment, viewer = "patient" }: { appointment: Appointment; viewer?: "patient" | "doctor" }) {
  const { language, t } = useApp();
  const label = t(appointment.status === "confirmed" ? "statusConfirmed" : appointment.status === "completed" ? "statusCompleted" : appointment.status === "cancelled" ? "statusCancelled" : "statusRequested");
  const pillStatus = appointment.status === "confirmed" || appointment.status === "completed" ? "confirmed" : appointment.status === "cancelled" ? "missed" : "requested";
  const purposeKey = getAppointmentPurposeKey(appointment.purpose);
  return <Card className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/50">{viewer === "doctor" ? <UserRound /> : <Stethoscope />}</span><div><h3 className="text-xl font-extrabold">{viewer === "doctor" ? appointment.patient_name : appointment.doctor_name}</h3><p className="mt-1 text-base text-muted">{appointment.facility}</p></div></div><StatusPill status={pillStatus} label={label} /></div><div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800 sm:grid-cols-2"><p className="flex items-center gap-2 font-bold"><CalendarDays className="text-primary" />{appointmentDate(appointment.starts_at, language)}</p><p className="flex items-center gap-2 font-bold"><Clock3 className="text-primary" />{appointmentTime(appointment.starts_at, language)}</p><p className="sm:col-span-2 text-muted">{purposeKey ? t(purposeKey) : appointment.purpose}</p></div><div className="mt-5"><Button asChild variant="secondary"><Link href={viewer === "doctor" ? `/doctor/appointments/${appointment.id}` : `/patient/appointments/${appointment.id}`}><FileHeart />{t(viewer === "doctor" ? "openAppointment" : "viewShareFiles")}</Link></Button></div></Card>;
}
