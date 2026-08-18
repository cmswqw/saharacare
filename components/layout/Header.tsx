"use client";
import Link from "next/link";
import { Bell, Bot, HeartPulse, Settings } from "lucide-react";
import { NotificationRealtime } from "@/components/realtime/NotificationRealtime";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useApp } from "@/components/providers/AppProvider";

export function Header({ mode = "patient", unreadCount = 0 }: { mode?: "patient" | "caregiver" | "doctor"; unreadCount?: number }) {
  const profile = useCurrentUser();
  const { t } = useApp();
  const caregiver = mode === "caregiver";
  const home = mode === "patient" ? "/patient" : mode === "caregiver" ? "/caregiver" : "/doctor";
  return <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
    {mode !== "doctor" ? <NotificationRealtime userId={profile.id} /> : null}
    <Link href={home} className="flex items-center gap-3 rounded-xl"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white"><HeartPulse aria-hidden="true" /></span><span className="hidden text-xl font-extrabold sm:block">SaharaCare</span></Link>
    <div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="max-w-40 truncate text-sm font-extrabold">{profile.full_name}</p><p className="text-xs font-bold text-muted">{t(profile.role === "patient" ? "rolePatient" : profile.role === "caregiver" ? "roleCaregiver" : "roleDoctor")}</p></div><div className="hidden md:block"><LanguageToggle /></div>{caregiver ? <Link href="/caregiver/assistant" className="grid h-12 w-12 place-items-center rounded-2xl border bg-card" aria-label={t("assistantAriaLabel")}><Bot aria-hidden="true" /></Link> : null}{mode !== "doctor" ? <Link href={caregiver ? "/caregiver/notifications" : "/patient/notifications"} className="relative grid h-12 w-12 place-items-center rounded-2xl border bg-card" aria-label={t("unreadNotifications", { count: unreadCount })}><Bell aria-hidden="true" />{unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-danger px-1 text-xs font-bold text-white">{unreadCount}</span> : null}</Link> : null}{mode !== "patient" ? <Link href="/settings" className="grid h-12 w-12 place-items-center rounded-2xl border bg-card" aria-label={t("settings")}><Settings aria-hidden="true" /></Link> : null}<LogoutButton iconOnly /></div>
  </div></header>;
}
