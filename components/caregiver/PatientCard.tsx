import Link from "next/link";
import { ArrowRight, Clock3, Pill, UserRound } from "lucide-react";
import { AdherenceRing } from "@/components/caregiver/AdherenceRing";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { countDoseStatuses, formatDoseTimestamp } from "@/lib/dose-config";
import type { DoseStatus, LinkedPatient } from "@/types";

const statusLabels: Record<DoseStatus, string> = {
  scheduled: "Scheduled",
  taken: "Taken",
  late: "Late",
  missed: "Missed",
};

export function PatientCard({ patient }: { patient: LinkedPatient }) {
  const counts = countDoseStatuses(patient.today_doses);
  const currentDose = patient.today_doses.find((dose) => dose.status !== "taken")
    ?? patient.today_doses[0];

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-blue-100 to-violet-100 text-primary">
          <UserRound className="h-14 w-14" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-extrabold">{patient.full_name}</h2>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">Linked</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-muted">
            <span className="flex items-center gap-2"><Pill className="text-primary" />{patient.today_doses.length} doses today</span>
            <span>{counts.taken} taken</span>
            {counts.late > 0 ? <span className="text-amber-800">{counts.late} late</span> : null}
            {counts.missed > 0 ? <span className="text-danger">{counts.missed} missed</span> : null}
          </div>
          {currentDose ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 font-bold"><Clock3 className="text-primary" />{formatDoseTimestamp(currentDose.scheduled_at)} · {currentDose.medication.name}</span>
              <StatusPill status={currentDose.status} label={statusLabels[currentDose.status]} />
            </div>
          ) : (
            <p className="mt-4 text-sm font-bold text-muted">No dose records are available for today.</p>
          )}
        </div>
        {patient.linking_code ? (
          <Link
            href={`/caregiver/patient/${encodeURIComponent(patient.linking_code)}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white"
          >
            View today<ArrowRight />
          </Link>
        ) : null}
      </div>
      <div className="mt-6 flex flex-col items-center gap-4 border-t pt-5 sm:flex-row">
        <AdherenceRing value={patient.weekly_adherence.percentage} />
        <div>
          <p className="text-lg font-extrabold">Weekly adherence</p>
          <p className="mt-1 font-bold text-muted">
            {patient.weekly_adherence.eligible > 0
              ? `${patient.weekly_adherence.taken} of ${patient.weekly_adherence.eligible} eligible doses taken`
              : "No eligible doses yet"}
          </p>
          <p className="mt-2 text-sm font-semibold text-muted">
            {patient.weekly_adherence.late} late · {patient.weekly_adherence.missed} missed
          </p>
        </div>
      </div>
    </Card>
  );
}
