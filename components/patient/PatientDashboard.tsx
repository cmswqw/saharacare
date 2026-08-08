"use client";

import Link from "next/link";
import { Activity, CalendarCheck2, Plus } from "lucide-react";
import { AdherenceSummaryCard } from "@/components/analytics/AdherenceSummaryCard";
import { TodayDoseTimeline } from "@/components/doses/TodayDoseTimeline";
import { MedicationHistory } from "@/components/history/MedicationHistory";
import { CurrentMedicineCard } from "@/components/medicine/CurrentMedicineCard";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { PatientLinkingCard } from "@/components/linking/PatientLinkingCard";
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
  linkingCode,
  caregiverLinks,
  todayDoses,
  weeklyAdherence,
  recentHistory,
}: {
  medications: Medication[];
  linkingCode: string;
  caregiverLinks: LinkedCaregiver[];
  todayDoses: TodayDose[];
  weeklyAdherence: AdherenceSummary;
  recentHistory: DoseHistoryItem[];
}) {
  const { t, activities, language } = useApp();
  const profile = useCurrentUser();
  const activeMedications = medications.filter((medication) => medication.active);
  const currentDose = todayDoses.find((dose) => dose.status !== "taken")
    ?? todayDoses[0];

  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow">{formatDoseDate(new Date().toISOString())}</p>
        <h1 className="patient-heading mt-2">
          {language === "ne" ? `नमस्ते, ${profile.full_name}` : `Good morning, ${profile.full_name}`}
        </h1>
        <p className="mt-3 text-xl leading-relaxed text-muted">{t("greetingDetail")}</p>
      </section>

      {currentDose ? (
        <CurrentMedicineCard dose={currentDose} />
      ) : activeMedications.length === 0 ? (
        <MedicationEmptyState>
          <Button asChild><Link href="/patient/medicines"><Plus />Add medication</Link></Button>
        </MedicationEmptyState>
      ) : (
        <Card className="border-green-200 bg-green-50 p-8 text-center dark:bg-green-950/20">
          <CalendarCheck2 className="mx-auto h-14 w-14 text-success" />
          <h2 className="mt-4 text-2xl font-extrabold">No doses scheduled today</h2>
          <p className="mt-2 text-muted">Your active medication plan has no times for this weekday.</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/patient/medicines">Manage plan</Link>
          </Button>
        </Card>
      )}

      {todayDoses.length > 0 ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">{todayDoses.length} {todayDoses.length === 1 ? "dose" : "doses"}</p>
              <h2 className="section-title mt-1">{t("todaysSchedule")}</h2>
            </div>
            <Button asChild variant="secondary"><Link href="/patient/medicines">Manage plan</Link></Button>
          </div>
          <TodayDoseTimeline doses={todayDoses} />
        </section>
      ) : null}

      <AdherenceSummaryCard summary={weeklyAdherence} />

      <MedicationHistory history={recentHistory} />

      <PatientLinkingCard linkingCode={linkingCode} links={caregiverLinks} />

      <ContactsSection />

      <section>
        <div className="mb-5">
          <p className="eyebrow">Latest updates</p>
          <h2 className="section-title mt-1">{t("recentActivity")}</h2>
        </div>
        <Card className="divide-y p-2">
          {activities.slice(0, 3).map((activity, index) => (
            <div key={`${activity}-${index}`} className="flex items-center gap-4 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 text-primary">
                <Activity />
              </span>
              <p className="font-semibold">{activity}</p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
