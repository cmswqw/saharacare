"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { patientMobileNavigation } from "@/constants/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { cn } from "@/lib/utils";

export function MobileBottomNavigation() {
  const pathname = usePathname(); const { t } = useApp();
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(8,52,48,0.08)] backdrop-blur lg:hidden" aria-label={t("patientNavigation")}><div className="mx-auto grid max-w-2xl grid-cols-5">{patientMobileNavigation.map(({ href, label, icon: Icon }) => { const active = href === "/patient" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("relative flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-bold leading-tight transition-colors", active ? "text-primary" : "text-muted hover:text-foreground")} aria-current={active ? "page" : undefined}>{active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" /> : null}<Icon className={cn("h-6 w-6 shrink-0", active && "fill-blue-100")} aria-hidden="true" /><span className="max-w-full break-words">{t(label)}</span></Link>; })}</div></nav>;
}
