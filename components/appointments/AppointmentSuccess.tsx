"use client";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export function AppointmentSuccess({ onReset }: { onReset: () => void }) {
  const { t } = useApp();
  return <div className="rounded-3xl border border-green-200 bg-green-50 p-6 text-center dark:bg-green-950/30"><CheckCircle2 className="mx-auto h-16 w-16 text-success" /><h3 className="mt-4 text-2xl font-extrabold">{t("requestSent")}</h3><p className="mt-4 text-base text-muted">{t("notConfirmed")}</p><Button className="mt-6" size="large" onClick={onReset}>{t("makeAnotherRequest")}</Button></div>;
}
