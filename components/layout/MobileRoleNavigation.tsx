"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { caregiverNavigation, doctorNavigation } from "@/constants/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { cn } from "@/lib/utils";

export function MobileRoleNavigation({ mode }: { mode: "caregiver" | "doctor" }) {
  const pathname = usePathname();
  const { t } = useApp();
  const navigation = mode === "caregiver" ? caregiverNavigation : doctorNavigation;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(8,52,48,0.08)] backdrop-blur lg:hidden" aria-label={t("mobileNavigation")}>
      <div className="mx-auto grid max-w-2xl auto-cols-fr grid-flow-col">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === `/${mode}`
            ? pathname === href
              || pathname.startsWith(`/${mode}/patient`)
              || (mode === "doctor" && pathname.startsWith("/doctor/appointments"))
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-xs font-bold transition-colors",
                active ? "text-primary" : "text-muted",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" /> : null}
              <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span className="max-w-full break-words leading-tight">{t(label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
