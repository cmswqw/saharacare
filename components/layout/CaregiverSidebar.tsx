"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, UserRound } from "lucide-react";
import { caregiverNavigation } from "@/constants/navigation";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useApp } from "@/components/providers/AppProvider";
import { cn } from "@/lib/utils";

export function CaregiverSidebar() {
  const pathname = usePathname();
  const profile = useCurrentUser();
  const { t } = useApp();

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-72 border-e border-blue-900 bg-blue-950 p-5 text-white lg:flex lg:flex-col">
      <Link href="/caregiver" className="mb-10 flex items-center gap-3 rounded-2xl px-2 py-1">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary"><HeartPulse /></span>
        <span className="text-2xl font-extrabold">SaharaCare</span>
      </Link>
      <p className="mb-4 px-4 text-sm font-bold uppercase tracking-widest text-blue-200">{t("caregiverView")}</p>
      <nav className="space-y-2">
        {caregiverNavigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/caregiver" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 items-center gap-4 rounded-2xl px-4 text-base font-bold",
                active ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)]" : "text-blue-100 hover:bg-blue-900",
              )}
            >
              <Icon aria-hidden="true" />
              {t(label)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-blue-800 bg-blue-900/50 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-800 text-blue-200"><UserRound /></span>
          <div className="min-w-0">
            <p className="truncate font-extrabold">{profile.full_name}</p>
            <p className="text-sm font-semibold text-blue-200">{t("authenticatedCaregiver")}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
