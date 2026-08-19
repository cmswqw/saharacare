"use client";

import Link from "next/link";
import { CalendarCheck2, Plus } from "lucide-react";
import { AdherenceSummaryCard } from "@/components/analytics/AdherenceSummaryCard";
import { TodayDoseTimeline } from "@/components/doses/TodayDoseTimeline";
import { MedicationHistory } from "@/components/history/MedicationHistory";
import { CurrentMedicineCard } from "@/components/medicine/CurrentMedicineCard";
import { CaregiverStatusCard, QuickActionsCard, TodayProgressCard, UpcomingRemindersCard } from "@/components/patient/PatientDashboardSections";
import { useApp } from "@/components/providers/AppProvider";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MedicationEmptyState } from "@/components/ui/DataState";
import { formatDoseDate } from "@/lib/dose-config";
import type {
  AdherenceSummary,
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
}: {
  medications: Medication[];
  caregiverLinks: LinkedCaregiver[];
  todayDoses: TodayDose[];
  weeklyAdherence: AdherenceSummary;
  recentHistory: DoseHistoryItem[];
}) {
  const { t, language } = useApp();
  const profile = useCurrentUser();
  const activeMedications = medications.filter((medication) => medication.active);
  const currentDose = todayDoses.find((dose) => dose.status !== "taken")
    ?? todayDoses[0];

  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow">{formatDoseDate(new Date().toISOString(), language)}</p>
        <h1 className="patient-heading mt-2">
          {t("greetingName", { name: profile.full_name })}
        </h1>
        <p className="mt-3 text-xl leading-relaxed text-muted">{t("greetingDetail")}</p>
      </section>

      {currentDose ? (
        <CurrentMedicineCard dose={currentDose} />
      ) : activeMedications.length === 0 ? (
        <MedicationEmptyState>
          <Button asChild><Link href="/patient/medicines"><Plus />{t("addMedication")}</Link></Button>
        </MedicationEmptyState>
      ) : (
        <Card className="border-green-200 bg-green-50 p-8 text-center dark:bg-green-950/20">
          <CalendarCheck2 className="mx-auto h-14 w-14 text-success" />
          <h2 className="mt-4 text-2xl font-extrabold">{t("noDosesScheduledToday")}</h2>
          <p className="mt-2 text-muted">{t("noWeekdayTimes")}</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/patient/medicines">{t("managePlan")}</Link>
          </Button>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <UpcomingRemindersCard doses={todayDoses} />
        <TodayProgressCard doses={todayDoses} />
        <CaregiverStatusCard links={caregiverLinks} />
        <QuickActionsCard />
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
    </div>
  );
}
