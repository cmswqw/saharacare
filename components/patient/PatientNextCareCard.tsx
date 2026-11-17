"use client";

import Link from "next/link";
import { CalendarDays, CheckCheck, ChevronRight, Clock3, Pill } from "lucide-react";
import { MarkDoseTakenButton } from "@/components/doses/MarkDoseTakenButton";
import { useApp } from "@/components/providers/AppProvider";
import { Card } from "@/components/ui/Card";
import { formatDoseTimestamp, SAHARACARE_TIME_ZONE } from "@/lib/dose-config";
import type { Appointment, TodayDose } from "@/types";

export function PatientNextCareCard({ dose, appointment, hasMedications, hasDoses, appointmentsUnavailable }: {
  dose: TodayDose | null;
  appointment: Appointment | null;
  hasMedications: boolean;
  hasDoses: boolean;
  appointmentsUnavailable: boolean;
}) {
  const { language, t } = useApp();
  const appointmentTime = appointment ? new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    timeZone: SAHARACARE_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(appointment.starts_at)) : "";
  const urgentDose = dose?.status === "late" || dose?.status === "missed";

  return <div className="relative space-y-2.5" data-testid="next-care-cards">
    <Card className="min-w-0 rounded-xl border-white/70 p-3 shadow-soft sm:p-4 dark:border-border" data-testid="next-medicine-card">
      {dose ? (
        <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2.5 gap-y-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary dark:bg-blue-950"><Pill className="h-6 w-6 -rotate-12" strokeWidth={1.7} aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-xs font-semibold text-muted">{t("nextMedicine")}</h2>
              {urgentDose ? <span className="text-xs font-bold text-danger">{t(dose.status)}</span> : null}
            </div>
            <h3 className="mt-0.5 break-words text-base font-extrabold leading-snug sm:text-lg">{dose.medication.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-snug">
              <p className="break-words text-muted">{dose.medication.dosage}</p>
              <time dateTime={dose.scheduled_at} className="inline-flex items-center gap-1 font-bold text-primary"><Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{formatDoseTimestamp(dose.scheduled_at, language)}</time>
            </div>
          </div>
          <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2">
            {dose.medication.instructions ? <p className="min-w-0 flex-1 break-words text-sm leading-snug text-muted">{dose.medication.instructions}</p> : null}
            <div className="max-w-full shrink-0"><MarkDoseTakenButton key={dose.id} doseId={dose.id} status={dose.status} takenAt={dose.taken_at} compact /></div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <CheckCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="break-words text-sm font-bold">{t(hasDoses ? "allDosesRecorded" : hasMedications ? "noDosesScheduledToday" : "noMedicationsYet")}</h2>
            <p className="mt-1 break-words text-sm leading-snug text-muted">{t(hasDoses ? "carePlanUpToDate" : hasMedications ? "noWeekdayTimes" : "noMedicationsHelp")}</p>
            <Link href="/patient/medicines" className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-bold text-primary">{t(hasMedications ? "managePlan" : "addMedication")}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      )}
    </Card>

    <Card className="min-w-0 rounded-xl border-white/70 p-3 shadow-soft sm:p-4 dark:border-border" data-testid="next-appointment-card">
      <Link href={appointment ? `/patient/appointments/${appointment.id}` : "/patient/appointments"} className="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg focus-visible:ring-4 focus-visible:ring-primary/30">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary dark:bg-blue-950"><CalendarDays className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold text-muted">{t("nextAppointment")}</h2>
          {appointment ? <>
            <h3 className="mt-0.5 break-words text-base font-extrabold leading-snug sm:text-lg">{appointment.doctor_name}</h3>
            <p className="mt-0.5 break-words text-sm leading-snug text-muted">{appointment.facility}</p>
            <time dateTime={appointment.starts_at} className="mt-1 block text-sm font-bold leading-snug text-primary">{appointmentTime}</time>
          </> : <>
            <p className="mt-0.5 break-words text-sm font-bold leading-snug">{t(appointmentsUnavailable ? "careDirectoryUnavailable" : "noUpcomingAppointment")}</p>
            <p className="mt-1 text-sm leading-snug text-muted">{t("bookYourNextVisit")}</p>
          </>}
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary group-hover:bg-blue-100 dark:bg-blue-950"><ChevronRight className="h-5 w-5" aria-hidden="true" /><span className="sr-only">{t(appointment ? "viewCareDetails" : "exploreAppointments")}</span></span>
      </Link>
    </Card>
  </div>;
}
