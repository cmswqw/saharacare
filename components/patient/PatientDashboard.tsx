"use client";

import Link from "next/link";
import { ArrowDown, HeartPulse, ShieldCheck } from "lucide-react";
import { AdherenceSummaryCard } from "@/components/analytics/AdherenceSummaryCard";
import { TodayDoseTimeline } from "@/components/doses/TodayDoseTimeline";
import { MedicationHistory } from "@/components/history/MedicationHistory";
import { CaregiverStatusCard, QuickActionsCard, TodayProgressCard, UpcomingRemindersCard } from "@/components/patient/PatientDashboardSections";
import { PatientCareDirectory } from "@/components/patient/PatientCareDirectory";
import { PatientNextCareCard } from "@/components/patient/PatientNextCareCard";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { formatDoseDate } from "@/lib/dose-config";
import { getPatientHomeSummary } from "@/lib/patient-home";
import type {
  AdherenceSummary,
  Appointment,
  DoseHistoryItem,
  LinkedCaregiver,
  Medication,
  TodayDose,
} from "@/types";

export function PatientDashboard({
  medications,
  caregiverLinks,
  todayDoses,
  weeklyAdherence,
  recentHistory,
  appointments = [],
  doctors = [],
  appointmentsUnavailable = false,
  doctorsUnavailable = false,
}: {
  medications: Medication[];
  caregiverLinks: LinkedCaregiver[];
  todayDoses: TodayDose[];
  weeklyAdherence: AdherenceSummary;
  recentHistory: DoseHistoryItem[];
  appointments?: Appointment[];
  doctors?: { id: string; full_name: string }[];
  appointmentsUnavailable?: boolean;
  doctorsUnavailable?: boolean;
}) {
  const { t, language, setLanguage } = useApp();
  const activeMedications = medications.filter((medication) => medication.active);
  const { nextDose, nextAppointment } = getPatientHomeSummary(todayDoses, appointments);

  return (
    <div className="patient-home min-w-0">
      <div className="relative -mx-4 -mt-5 px-4 pb-1 pt-4 sm:-mx-6 sm:px-6 md:-mx-8 md:-mt-8 md:px-8 md:pt-6">
        <div className="absolute inset-x-0 top-0 h-[calc(100%-3rem)] rounded-b-[2rem] bg-gradient-to-br from-primary via-primary to-brand-500" aria-hidden="true" />
        <div className="relative mb-3 flex items-center justify-between gap-3 text-white">
          <div className="min-w-0"><p className="text-xs font-medium text-white/80">{formatDoseDate(new Date().toISOString(), language)}</p><h1 className="mt-1 text-xl font-bold leading-snug tracking-tight sm:text-2xl">{t("yourCareAtAGlance")}</h1></div>
          <button type="button" onClick={() => setLanguage(language === "en" ? "ne" : "en")} aria-label={t("chooseLanguage")} className="min-h-11 shrink-0 rounded-xl border border-white/30 bg-white/10 px-3 text-sm font-bold hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/60">{language === "en" ? "नेपाली" : "English"}</button>
        </div>
        <PatientNextCareCard dose={nextDose} appointment={nextAppointment} hasMedications={activeMedications.length > 0} hasDoses={todayDoses.length > 0} appointmentsUnavailable={appointmentsUnavailable} />
      </div>

      <div className="mt-4 space-y-4 md:space-y-7">
        <QuickActionsCard />

        <div className="relative flex items-center gap-4 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 to-card p-5 sm:p-6 dark:from-blue-950 dark:to-card">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm"><HeartPulse className="h-8 w-8" strokeWidth={1.6} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold leading-snug sm:text-xl">{t("careForToday")}</h2><p className="mt-1 text-sm leading-relaxed text-muted">{t("careForTodayDetail")}</p></div>
        </div>

        <PatientCareDirectory doctors={doctors} appointments={appointments} doctorsUnavailable={doctorsUnavailable} appointmentsUnavailable={appointmentsUnavailable} />

        <div className="flex items-center gap-3 border-t pt-5"><h2 className="text-xl font-extrabold">{t("todaysCare")}</h2><ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" /></div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <UpcomingRemindersCard doses={todayDoses} />
          <TodayProgressCard doses={todayDoses} />
          <CaregiverStatusCard links={caregiverLinks} />
        </div>

      {todayDoses.length > 0 ? (
        <section id="today-schedule" className="scroll-mt-24">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">
                {t(todayDoses.length === 1 ? "doseCountOne" : "doseCountMany", { count: todayDoses.length })}
              </p>
              <h2 className="section-title mt-1">{t("todaysSchedule")}</h2>
            </div>
            <Button asChild variant="secondary"><Link href="/patient/medicines">{t("managePlan")}</Link></Button>
          </div>
          <TodayDoseTimeline doses={todayDoses} />
        </section>
      ) : null}

      <AdherenceSummaryCard summary={weeklyAdherence} />

      <MedicationHistory history={recentHistory} />
        <p className="flex items-center justify-center gap-2 py-3 text-center text-xs text-muted"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{t("privateCareNote")}</p>
      </div>
    </div>
  );
}
