import { Check, Clock3, Pill, TriangleAlert } from "lucide-react";
import { MarkDoseTakenButton } from "@/components/doses/MarkDoseTakenButton";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDoseTimestamp } from "@/lib/dose-config";
import type { DoseStatus, TodayDose } from "@/types";

const statusLabels: Record<DoseStatus, string> = {
  scheduled: "Scheduled",
  taken: "Taken",
  late: "Late",
  missed: "Missed",
};

function DoseIcon({ status }: { status: DoseStatus }) {
  if (status === "taken") return <Check />;
  if (status === "late" || status === "missed") return <TriangleAlert />;
  return <Clock3 />;
}

export function TodayDoseTimeline({
  doses,
  readOnly = false,
}: {
  doses: TodayDose[];
  readOnly?: boolean;
}) {
  if (doses.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-5 text-muted dark:bg-slate-900">
        No doses are scheduled for today.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {doses.map((dose, index) => (
        <div key={dose.id} className="relative grid grid-cols-[48px_1fr] gap-3 pb-5">
          <div className="relative flex justify-center">
            {index < doses.length - 1 ? (
              <span className="absolute bottom-0 top-10 w-0.5 bg-slate-200 dark:bg-slate-700" />
            ) : null}
            <span className={`relative grid h-11 w-11 place-items-center rounded-full ${
              dose.status === "taken"
                ? "bg-green-100 text-green-700"
                : dose.status === "missed"
                  ? "bg-red-100 text-red-700"
                  : dose.status === "late"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-primary"
            }`}>
              <DoseIcon status={dose.status} />
            </span>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-extrabold">{formatDoseTimestamp(dose.scheduled_at)}</p>
                <p className="mt-1 flex items-center gap-2 font-bold">
                  <Pill className="h-5 w-5 rotate-45 text-primary" />
                  {dose.medication.name} · {dose.medication.dosage}
                </p>
                {dose.medication.instructions ? (
                  <p className="mt-2 text-sm text-muted">{dose.medication.instructions}</p>
                ) : null}
                {dose.taken_at ? (
                  <p className="mt-2 font-bold text-success">Taken at {formatDoseTimestamp(dose.taken_at)}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <StatusPill status={dose.status} label={statusLabels[dose.status]} />
                {!readOnly ? (
                  <MarkDoseTakenButton
                    doseId={dose.id}
                    status={dose.status}
                    takenAt={dose.taken_at}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
