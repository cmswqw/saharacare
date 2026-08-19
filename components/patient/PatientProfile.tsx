"use client";

import Link from "next/link";
import { Languages, Mail, Settings, ShieldCheck, UserRound } from "lucide-react";
import { PatientLinkingCard } from "@/components/linking/PatientLinkingCard";
import { useApp } from "@/components/providers/AppProvider";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LinkedCaregiver } from "@/types";

export function PatientProfile({ linkingCode, caregiverLinks }: { linkingCode: string; caregiverLinks: LinkedCaregiver[] }) {
  const { language, t } = useApp();
  const profile = useCurrentUser();

  return (
    <div className="space-y-8">
      <header><p className="eyebrow">{t("personalDetails")}</p><h1 className="patient-heading mt-2">{t("profile")}</h1><p className="mt-3 text-lg text-muted">{t("profileRealDataHelp")}</p></header>
      <Card className="p-5 md:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-blue-50 text-primary dark:bg-blue-950"><UserRound className="h-12 w-12" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-3xl font-extrabold">{profile.full_name}</h2><p className="mt-2 flex items-center gap-2 text-muted"><Mail className="h-5 w-5" />{profile.email ?? t("notProvided")}</p><p className="mt-2 flex items-center gap-2 font-bold text-success"><ShieldCheck className="h-5 w-5" />{t("authenticatedPatientProfile")}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900"><p className="text-sm font-bold uppercase tracking-wide text-muted">{t("language")}</p><p className="mt-2 flex items-center gap-2 font-extrabold"><Languages className="text-primary" />{language === "ne" ? "नेपाली" : "English"}</p></div>
        </div>
      </Card>
      <PatientLinkingCard linkingCode={linkingCode} links={caregiverLinks} />
      <Button asChild variant="secondary" size="large" className="w-full"><Link href="/settings"><Settings />{t("settings")}</Link></Button>
    </div>
  );
}
