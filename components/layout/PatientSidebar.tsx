"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, Settings } from "lucide-react";
import { patientNavigation } from "@/constants/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { cn } from "@/lib/utils";

export function PatientSidebar() {
  const pathname = usePathname();
  const { t } = useApp();

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-72 border-e bg-card p-5 lg:flex lg:flex-col">
      <Link href="/patient" className="mb-10 flex items-center gap-3 rounded-2xl px-2 py-1">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white">
          <HeartPulse />
        </span>
        <span className="text-2xl font-extrabold">SaharaCare</span>
      </Link>
      <nav aria-label={t("patientNavigation")} className="space-y-2">
        {patientNavigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/patient" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-16 items-center gap-4 rounded-2xl px-4 text-lg font-bold transition-colors",
                active
                  ? "bg-blue-50 text-primary dark:bg-blue-950/50"
                  : "text-muted hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
              {t(label)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <Link
          href="/settings"
          className="flex min-h-16 items-center gap-4 rounded-2xl px-4 text-lg font-bold text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Settings aria-hidden="true" />
          {t("settings")}
        </Link>
        <p className="mt-4 px-4 text-sm text-muted">
          {t("secureMedicationRecords")}
          <br />
          {t("connectedWithSupabase")}
        </p>
      </div>
    </aside>
  );
}
