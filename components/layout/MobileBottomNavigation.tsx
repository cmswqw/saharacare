"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { patientNavigation } from "@/constants/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { cn } from "@/lib/utils";

export function MobileBottomNavigation() {
  const pathname = usePathname(); const { t } = useApp();
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Patient navigation"><div className="mx-auto grid max-w-xl grid-cols-4">{patientNavigation.map(({ href, label, icon: Icon }) => { const active = href === "/patient" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex min-h-[74px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-bold", active ? "text-primary" : "text-muted")} aria-current={active ? "page" : undefined}><Icon className={cn("h-6 w-6", active && "fill-blue-100")} aria-hidden="true" /><span className="line-clamp-1">{t(label)}</span></Link>; })}</div></nav>;
}
