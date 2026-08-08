import { Check, Clock3, TriangleAlert } from "lucide-react";
import { AdherenceRing } from "@/components/caregiver/AdherenceRing";
import { Card } from "@/components/ui/Card";
import type { AdherenceSummary } from "@/types";

export function AdherenceSummaryCard({ summary }: { summary: AdherenceSummary }) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <AdherenceRing value={summary.percentage} />
        <div className="flex-1">
          <p className="eyebrow">Last 7 local calendar days</p>
          <h2 className="mt-1 text-2xl font-extrabold">Weekly adherence</h2>
          <p className="mt-3 text-lg font-bold">
            {summary.eligible > 0
              ? `${summary.taken} of ${summary.eligible} eligible doses taken`
              : "No doses are due in this window yet"}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <p className="flex items-center gap-2 rounded-2xl bg-green-50 p-3 font-bold text-green-800 dark:bg-green-950/30 dark:text-green-100">
              <Check />{summary.taken} taken
            </p>
            <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Clock3 />{summary.late} late
            </p>
            <p className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 font-bold text-red-800 dark:bg-red-950/30 dark:text-red-100">
              <TriangleAlert />{summary.missed} missed
            </p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Future doses are excluded. A dose taken after the late threshold counts as taken and is also included in the late count.
          </p>
        </div>
      </div>
    </Card>
  );
}
