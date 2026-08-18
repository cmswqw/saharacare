"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BellRing, Check, HeartPulse, Pill, ShieldCheck, UsersRound } from "lucide-react";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export default function LandingPage() {
  const { t } = useApp();

  return (
    <main className="min-h-screen overflow-hidden bg-[#F8FAFC] text-[#111827] dark:bg-slate-950 dark:text-slate-50">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white">
            <HeartPulse />
          </span>
          <span className="hidden text-2xl font-extrabold sm:inline">SaharaCare</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden min-h-12 items-center rounded-2xl px-4 font-extrabold text-primary hover:bg-blue-50 sm:flex">
            {t("signIn")}
          </Link>
          <LanguageToggle />
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-100px)] max-w-7xl items-center gap-12 px-5 pb-16 pt-8 md:px-10 lg:grid-cols-[1.02fr_0.98fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-primary dark:bg-blue-950/40">
            <ShieldCheck className="h-5 w-5" />
            {t("simpleCareSupport")}
          </div>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            {t("tagline")}
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-[#4B5563] dark:text-slate-300">
            {t("taglineDetail")}
          </p>
          <p className="mt-3 text-xl font-bold text-primary">
            {t("landingAlternateTagline")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="large" className="min-h-20 w-full text-2xl sm:w-auto sm:px-10">
              <Link href="/role">
                {t("getStarted")}
                <span aria-hidden="true">→</span>
              </Link>
            </Button>
            <Button asChild size="large" variant="secondary" className="sm:hidden">
              <Link href="/login">{t("signIn")}</Link>
            </Button>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-base font-bold text-muted">
            <span className="flex items-center gap-2"><Check className="text-success" />{t("secureSignIn")}</span>
            <span className="flex items-center gap-2"><Check className="text-success" />{t("bilingualSupport")}</span>
            <span className="flex items-center gap-2"><Check className="text-success" />{t("roleBasedAccess")}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mx-auto w-full max-w-xl"
        >
          <div className="absolute -inset-10 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-900/20" />
          <div className="relative rounded-[2.5rem] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(37,99,235,0.18)] dark:border-slate-700 dark:bg-slate-900 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-primary">{t("patientPreview")}</p>
                <p className="mt-1 text-2xl font-extrabold">{t("simpleDailySupport")}</p>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-primary"><UsersRound /></span>
            </div>
            <div className="mt-7 rounded-3xl bg-blue-50 p-5 dark:bg-blue-950/40">
              <div className="flex gap-4">
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-white text-primary">
                  <Pill className="h-11 w-11 rotate-45" />
                </span>
                <div>
                  <p className="text-sm font-bold text-primary">{t("medicineReminderUpper")}</p>
                  <h2 className="mt-1 text-2xl font-extrabold">{t("yourMedicine")}</h2>
                  <p className="mt-1 font-semibold text-muted">{t("previewDose")}</p>
                </div>
              </div>
              <div className="mt-5 flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-success px-5 text-xl font-bold text-white">
                <Check />{t("recordDoseSafely")}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <BellRing className="text-primary" />
                <p className="mt-3 font-extrabold">{t("gentleReminders")}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <HeartPulse className="text-danger" />
                <p className="mt-3 font-extrabold">{t("helpInOneTap")}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
