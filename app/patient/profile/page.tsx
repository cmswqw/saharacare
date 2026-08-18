"use client";

import Link from "next/link";
import { Building2, Languages, Pencil, Phone, Settings, Stethoscope, UserRound } from "lucide-react";
import { contacts } from "@/mock-data";
import { useApp } from "@/components/providers/AppProvider";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ProfilePage() {
  const { t, language, toast } = useApp();
  const profile = useCurrentUser();
  const rows = [
    { icon: Languages, label: t("language"), value: language === "ne" ? "नेपाली" : "English" },
    { icon: Stethoscope, label: t("doctor"), value: contacts[1].name },
    { icon: Building2, label: t("hospital"), value: contacts[2].name },
    { icon: Phone, label: t("emergencyContact"), value: `${contacts[0].name} · ${t("demoNumber")}` },
  ];

  return (
    <div>
      <p className="eyebrow">{t("personalDetails")}</p>
      <h1 className="patient-heading mt-2">{t("profile")}</h1>
      <Card className="mt-8 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:from-blue-950/50 dark:to-slate-800 md:p-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start">
            <span className="grid h-28 w-28 shrink-0 place-items-center rounded-full bg-white text-primary shadow-soft">
              <UserRound className="h-16 w-16" />
            </span>
            <div className="flex-1">
              <h2 className="text-3xl font-extrabold">{profile.full_name}</h2>
              <p className="mt-1 text-lg text-muted">{profile.email}</p>
              <p className="mt-3 text-base font-bold text-muted">{t(profile.role === "patient" ? "rolePatient" : profile.role === "caregiver" ? "roleCaregiver" : "roleDoctor")}</p>
            </div>
            <Button variant="secondary" onClick={() => toast(t("profileEditingUnavailable"))}>
              <Pencil />{t("editProfile")}
            </Button>
          </div>
        </div>
        <div className="divide-y px-5 md:px-8">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 py-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950"><Icon /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-lg font-extrabold">{value}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={t("editLabel", { label })} onClick={() => toast(t("editDemoOpened", { label }))}><Pencil /></Button>
            </div>
          ))}
        </div>
      </Card>
      <Button asChild variant="secondary" size="large" className="mt-6 w-full">
        <Link href="/settings"><Settings />{t("settings")}</Link>
      </Button>
      <p className="mt-4 text-center text-sm text-muted">
        {t("profileDataNotice")}
      </p>
    </div>
  );
}
