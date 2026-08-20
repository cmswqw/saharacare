"use client";

import Link from "next/link";
import { CalendarDays, Clock3, FileHeart, Stethoscope, UserRound, UsersRound } from "lucide-react";
import type { Appointment } from "@/types";
import { AppointmentManagement } from "@/components/appointments/AppointmentManagement";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useApp } from "@/components/providers/AppProvider";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentPurposeKey,
} from "@/lib/appointment-utils";

export function AppointmentCard({
  appointment,
  viewer = "patient",
}: {
  appointment: Appointment;
  viewer?: "patient" | "doctor" | "caregiver";
}) {
  const { language, t } = useApp();
  const label = t(appointment.status === "confirmed" ? "statusConfirmed" : appointment.status === "completed" ? "statusCompleted" : appointment.status === "cancelled" ? "statusCancelled" : "statusRequested");
  const pillStatus = appointment.status === "confirmed" || appointment.status === "completed" ? "confirmed" : appointment.status === "cancelled" ? "missed" : "requested";
  const purposeKey = getAppointmentPurposeKey(appointment.purpose);
  const canManage = (viewer === "patient" || viewer === "caregiver")
    && (appointment.status === "requested" || appointment.status === "confirmed");

  return <Card className="p-5 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/50">
          {viewer === "doctor" ? <UserRound aria-hidden="true" /> : <Stethoscope aria-hidden="true" />}
        </span>
        <div>
          <h3 className="text-xl font-extrabold">{viewer === "doctor" ? appointment.patient_name : appointment.doctor_name}</h3>
          <p className="mt-1 text-base text-muted">{appointment.facility}</p>
        </div>
      </div>
      <StatusPill status={pillStatus} label={label} />
    </div>
    <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800 sm:grid-cols-2">
      <p className="flex items-center gap-2 font-bold"><CalendarDays className="text-primary" aria-hidden="true" />{formatAppointmentDate(appointment.starts_at, language)}</p>
      <p className="flex items-center gap-2 font-bold"><Clock3 className="text-primary" aria-hidden="true" />{formatAppointmentTime(appointment.starts_at, language)}</p>
      <p className="text-muted sm:col-span-2">{purposeKey ? t(purposeKey) : appointment.purpose}</p>
      {appointment.created_by_role === "caregiver" ? (
        <p className="flex items-center gap-2 font-semibold text-muted sm:col-span-2">
          <UsersRound className="text-primary" aria-hidden="true" />
          {t("bookedByCaregiver", { name: appointment.created_by_name })}
        </p>
      ) : null}
    </div>
    {viewer !== "caregiver" ? (
      <div className="mt-5">
        <Button asChild variant="secondary">
          <Link href={viewer === "doctor" ? `/doctor/appointments/${appointment.id}` : `/patient/appointments/${appointment.id}`}>
            <FileHeart aria-hidden="true" />{t(viewer === "doctor" ? "openAppointment" : "viewShareFiles")}
          </Link>
        </Button>
      </div>
    ) : null}
    {canManage ? <AppointmentManagement appointmentId={appointment.id} doctorId={appointment.doctor_id} /> : null}
  </Card>;
}
