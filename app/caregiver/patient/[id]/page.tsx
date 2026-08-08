import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pill, UserRound } from "lucide-react";
import { AdherenceSummaryCard } from "@/components/analytics/AdherenceSummaryCard";
import { TodayDoseTimeline } from "@/components/doses/TodayDoseTimeline";
import { MedicationHistory } from "@/components/history/MedicationHistory";
import { CaregiverDoseRealtime } from "@/components/realtime/CaregiverDoseRealtime";
import { Card } from "@/components/ui/Card";
import { DataErrorState } from "@/components/ui/DataState";
import { formatDoseDate } from "@/lib/dose-config";
import { getLinkedPatientByCode } from "@/lib/data/phase4";

export default async function CaregiverPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getLinkedPatientByCode(decodeURIComponent(id));

  if (result.error) {
    return <DataErrorState message="This approved patient’s dose information could not be loaded." />;
  }
  if (!result.data || !result.data.full_name) notFound();

  const patient = result.data;
  const realtimePatients = patient.patient_id
    ? [{
        patientId: patient.patient_id,
        fullName: patient.full_name ?? "Patient",
        doses: patient.today_doses.map((dose) => ({
          id: dose.id,
          medicationName: dose.medication.name,
        })),
      }]
    : [];

  return (
    <div className="space-y-7">
      <CaregiverDoseRealtime patients={realtimePatients} />
      <Link href="/caregiver" className="inline-flex min-h-12 items-center gap-2 rounded-2xl font-bold text-primary">
        <ArrowLeft />Back to overview
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid h-24 w-24 place-items-center rounded-3xl bg-blue-50 text-primary dark:bg-blue-950/40">
            <UserRound className="h-14 w-14" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-widest text-primary">Approved patient</p>
            <h1 className="mt-1 text-3xl font-extrabold">{patient.full_name}</h1>
            <p className="mt-2 text-muted">Read-only dose information through an accepted caregiver link.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Pill className="rotate-45 text-primary" />
            <h2 className="text-2xl font-extrabold">Today’s doses</h2>
          </div>
          <p className="font-bold text-muted">{formatDoseDate(new Date().toISOString())}</p>
        </div>
        <div className="mt-6">
          <TodayDoseTimeline doses={patient.today_doses} readOnly />
        </div>
      </Card>

      <AdherenceSummaryCard summary={patient.weekly_adherence} />

      <MedicationHistory history={patient.recent_history} />
    </div>
  );
}
