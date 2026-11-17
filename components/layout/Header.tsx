"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bot, HeartPulse, Settings } from "lucide-react";
import { NotificationRealtime } from "@/components/realtime/NotificationRealtime";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useApp } from "@/components/providers/AppProvider";

export function Header({ mode = "patient", unreadCount = 0 }: { mode?: "patient" | "caregiver" | "doctor" | "admin"; unreadCount?: number }) {
  const profile = useCurrentUser();
  const { t } = useApp();
  const pathname = usePathname();
  const patientHome = mode === "patient" && pathname === "/patient";
  const caregiver = mode === "caregiver";
  const home = mode === "patient" ? "/patient" : mode === "caregiver" ? "/caregiver" : mode === "doctor" ? "/doctor" : "/admin";
  const roleLabel = profile.role === "patient" ? "rolePatient" : profile.role === "caregiver" ? "roleCaregiver" : profile.role === "doctor" ? "roleDoctor" : "roleAdmin";
  if (patientHome) {
    const initials = profile.full_name.trim().split(/\s+/).slice(0, 2).map((name) => Array.from(name)[0]).join("");
    return <header className="sticky top-0 z-30 bg-primary text-white">
      <NotificationRealtime userId={profile.id} />
      <div className="mx-auto flex min-h-24 max-w-[90rem] items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8">
        <Link href="/patient/profile" className="flex min-w-0 items-center gap-3 rounded-2xl focus-visible:ring-4 focus-visible:ring-white/60" aria-label={t("profile")}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-white/50 bg-white text-base font-extrabold text-primary" aria-hidden="true">{initials}</span>
          <span className="min-w-0"><span className="block text-xs font-medium text-white/80">{t("welcomeBack")}</span><span className="mt-0.5 block truncate text-lg font-bold leading-tight">{profile.full_name}</span><span className="mt-1 block truncate text-xs text-white/80">{profile.email ?? t(roleLabel)}</span></span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href="/patient/notifications" className="relative grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/60" aria-label={t("unreadNotifications", { count: unreadCount })}><Bell className="h-5 w-5" aria-hidden="true" />{unreadCount > 0 ? <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unreadCount}</span> : null}</Link>
          <Link href="/settings" className="hidden h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid" aria-label={t("settings")}><Settings className="h-5 w-5" aria-hidden="true" /></Link>
          <LogoutButton iconOnly className="[&_button]:h-11 [&_button]:min-h-11 [&_button]:w-11 [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20 [&_button_svg]:h-5 [&_button_svg]:w-5" />
        </div>
      </div>
    </header>;
  }
  return <header className="sticky top-0 z-30 border-b border-blue-100 bg-card/90 backdrop-blur-xl"><div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 md:min-h-20 md:px-8">
    {mode === "patient" || mode === "caregiver" ? <NotificationRealtime userId={profile.id} /> : null}
    <Link href={home} className="flex min-h-11 items-center gap-3 rounded-xl"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-[0_7px_16px_rgba(23,97,90,0.18)] md:h-11 md:w-11"><HeartPulse aria-hidden="true" /></span><span className="hidden text-xl font-extrabold tracking-tight sm:block">SaharaCare</span></Link>
    <div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="max-w-40 truncate text-sm font-extrabold">{profile.full_name}</p><p className="text-xs font-bold text-muted">{t(roleLabel)}</p></div><div className="hidden md:block"><LanguageToggle /></div>{caregiver ? <Link href="/caregiver/assistant" className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-card transition-colors hover:bg-blue-50 md:h-12 md:w-12" aria-label={t("assistantAriaLabel")}><Bot aria-hidden="true" /></Link> : null}{mode === "patient" || mode === "caregiver" ? <Link href={caregiver ? "/caregiver/notifications" : "/patient/notifications"} className="relative grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-card transition-colors hover:bg-blue-50 md:h-12 md:w-12" aria-label={t("unreadNotifications", { count: unreadCount })}><Bell aria-hidden="true" />{unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-danger px-1 text-xs font-bold text-white">{unreadCount}</span> : null}</Link> : null}{mode !== "patient" ? <Link href="/settings" className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-100 bg-card transition-colors hover:bg-blue-50 md:h-12 md:w-12" aria-label={t("settings")}><Settings aria-hidden="true" /></Link> : null}<LogoutButton iconOnly /></div>
  </div></header>;
}
