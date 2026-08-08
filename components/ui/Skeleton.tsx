import { cn } from "@/lib/utils";
export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700", className)} />; }
