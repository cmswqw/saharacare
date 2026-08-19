"use client";

import Link from "next/link";
import {
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileHeart,
  Pill,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Card } from "@/components/ui/Card";
import { countDoseStatuses, formatDoseTimestamp } from "@/lib/dose-config";
import type { LinkedCaregiver, TodayDose } from "@/types";

export function TodayProgressCard({ doses }: { doses: TodayDose[] }) {
  const { t } = useApp();
  const counts = countDoseStatuses(doses);
  const completed = counts.taken;
  const total = doses.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div><p className="eyebrow">{t("today")}</p><h2 className="mt-1 text-2xl font-extrabold">{t("todaysProgress")}</h2></div>
        <strong className="text-2xl text-primary">{progress}%</strong>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-label={t("progressPercent", { percent: progress })}>
        <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-green-50 p-3 dark:bg-green-950/30"><Check className="mx-auto text-success" /><strong className="mt-1 block text-xl">{counts.taken}</strong><span className="text-sm text-muted">{t("taken")}</span></div>
        <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/30"><Clock3 className="mx-auto text-primary" /><strong className="mt-1 block text-xl">{counts.scheduled}</strong><span className="text-sm text-muted">{t("upcoming")}</span></div>
        <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/30"><TriangleAlert className="mx-auto text-amber-700" /><strong className="mt-1 block text-xl">{counts.late + counts.missed}</strong><span className="text-sm text-muted">{t("needsAttention")}</span></div>
      </div>
    </Card>
  );
}

export function UpcomingRemindersCard({ doses }: { doses: TodayDose[] }) {
  const { language, t } = useApp();
  const upcoming = doses
    .filter((dose) => dose.status === "scheduled")
    .sort((left, right) => Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at))
    .slice(0, 3);

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div><p className="eyebrow">{t("medicineReminders")}</p><h2 className="mt-1 text-2xl font-extrabold">{t("upcomingToday")}</h2></div>
        <Link href="#today-schedule" className="font-bold text-primary hover:underline">{t("viewSchedule")}</Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-muted dark:bg-slate-900">{t(doses.length === 0 ? "noDosesToday" : "noUpcomingDoses")}</p>
      ) : (
        <div className="mt-4 divide-y">
          {upcoming.map((dose) => (
            <div key={dose.id} className="flex items-center gap-3 py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950"><Clock3 /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{dose.medication.name}</p><p className="mt-1 text-sm font-semibold text-muted">{dose.medication.dosage}</p></div>
              <time className="font-extrabold text-primary" dateTime={dose.scheduled_at}>{formatDoseTimestamp(dose.scheduled_at, language)}</time>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CaregiverStatusCard({ links }: { links: LinkedCaregiver[] }) {
  const { t } = useApp();
  const accepted = links.filter((link) => link.status === "accepted");
  const pending = links.filter((link) => link.status === "pending");
  const firstName = accepted[0]?.caregiver?.full_name;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-50 text-success dark:bg-green-950/30"><ShieldCheck /></span>
        <div className="min-w-0 flex-1"><p className="eyebrow">{t("caregiverAccess")}</p><h2 className="mt-1 text-2xl font-extrabold">{accepted.length > 0 ? t("caregiverConnected") : t("caregiverNotConnected")}</h2></div>
      </div>
      <p className="mt-4 leading-relaxed text-muted">
        {accepted.length > 0
          ? t("approvedCaregiverSummary", { name: firstName ?? t("approvedCaregiver"), count: accepted.length })
          : pending.length > 0
            ? t("pendingCaregiverSummary", { count: pending.length })
            : t("noCaregiverSummary")}
      </p>
      <Link href="/patient/profile#caregiver-access" className="mt-4 inline-flex min-h-12 items-center gap-2 font-extrabold text-primary hover:underline">{t("manageCaregiverAccess")}<ChevronRight /></Link>
    </Card>
  );
}

export function QuickActionsCard() {
  const { t } = useApp();
  const actions = [
    { href: "/patient/medicines", label: "medicines" as const, icon: Pill },
    { href: "/patient/appointments", label: "appointments" as const, icon: CalendarDays },
    { href: "/patient/medical-information", label: "medicalInfo" as const, icon: FileHeart },
    { href: "/patient/assistant", label: "assistant" as const, icon: Bot },
    { href: "/patient/profile", label: "caregiverAccess" as const, icon: UserRound },
  ];

  return (
    <Card className="p-5 md:p-6 xl:col-span-2">
      <p className="eyebrow">{t("shortcuts")}</p>
      <h2 className="mt-1 text-2xl font-extrabold">{t("quickActions")}</h2>
      <div className="mt-5 grid grid-cols-1 gap-4 min-[375px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-32 min-w-0 w-full flex-col items-center justify-center gap-3 rounded-2xl border bg-slate-50 px-2 py-4 text-center text-lg font-extrabold leading-tight whitespace-normal break-words [overflow-wrap:anywhere] transition-colors hover:border-primary/40 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:p-4 sm:text-[inherit] dark:bg-slate-900 dark:hover:bg-blue-950/40"
            aria-label={t(label)}
          >
            <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
            <span className="max-w-full">{t(label)}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
