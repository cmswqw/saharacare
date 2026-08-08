import { Check, Clock3, TriangleAlert } from "lucide-react";
import type { DoseStatus } from "@/types";
import { cn } from "@/lib/utils";

export function StatusPill({ status, label }: { status: DoseStatus | "confirmed" | "requested"; label?: string }) {
  const styles = status === "taken" || status === "confirmed"
    ? "bg-green-100 text-green-800"
    : status === "missed"
      ? "bg-red-100 text-red-800"
      : status === "late"
        ? "bg-amber-100 text-amber-900"
        : "bg-blue-100 text-blue-800";
  const Icon = status === "taken" || status === "confirmed"
    ? Check
    : status === "missed" || status === "late"
      ? TriangleAlert
      : Clock3;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", styles)}><Icon className="h-4 w-4" aria-hidden="true" />{label ?? status}</span>;
}
