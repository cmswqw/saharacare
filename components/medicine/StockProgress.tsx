"use client";

import { useApp } from "@/components/providers/AppProvider";

export function StockProgress({ value, total }: { value: number; total: number }) {
  const { t } = useApp();
  const percentage = Math.round((value / total) * 100); const low = percentage < 25;
  return <div><div className="mb-2 flex justify-between text-sm font-bold"><span>{t("stock")}</span><span>{value} / {total}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={t("dosesLeft", { value, total })}><div className={`h-full rounded-full ${low ? "bg-warning" : "bg-success"}`} style={{ width: `${percentage}%` }} /></div></div>;
}
