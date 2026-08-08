import { ProgressRing } from "@/components/ui/ProgressRing";
export function AdherenceRing({ value, label = "Weekly adherence" }: { value: number | null; label?: string }) { return <ProgressRing value={value} label={label} />; }
