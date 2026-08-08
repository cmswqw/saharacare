"use client";

import Link from "next/link";
import { ArrowLeft, HeartPulse, UserRound, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useApp } from "@/components/providers/AppProvider";

const choices = [
  {
    href: "/signup?role=patient",
    key: "patientRole" as const,
    detail: "patientRoleDetail" as const,
    Icon: UserRound,
    color: "bg-blue-50 text-primary dark:bg-blue-950/40",
  },
  {
    href: "/signup?role=caregiver",
    key: "caregiverRole" as const,
    detail: "caregiverRoleDetail" as const,
    Icon: UsersRound,
    color: "bg-green-50 text-green-700 dark:bg-green-950/40",
  },
];

export default function RolePage() {
  const { t } = useApp();

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="grid h-12 w-12 place-items-center rounded-2xl border bg-card" aria-label="Back">
            <ArrowLeft />
          </Link>
          <div className="flex items-center gap-2 font-extrabold">
            <HeartPulse className="text-primary" />
            SaharaCare
          </div>
          <LanguageToggle />
        </div>

        <div className="mx-auto mt-14 max-w-2xl text-center">
          <p className="eyebrow">One simple choice</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">{t("chooseRole")}</h1>
          <p className="mt-4 text-lg text-muted">{t("chooseRoleHelp")}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {choices.map(({ href, key, detail, Icon, color }, index) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <Link
                href={href}
                className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center transition-shadow hover:shadow-xl"
              >
                <span className={`grid h-24 w-24 place-items-center rounded-3xl ${color}`}>
                  <Icon className="h-14 w-14" />
                </span>
                <h2 className="mt-7 text-3xl font-extrabold">{t(key)}</h2>
                <p className="mt-3 max-w-sm text-lg leading-relaxed text-muted">{t(detail)}</p>
                <span className="mt-6 font-bold text-primary">Continue →</span>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center font-semibold text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-extrabold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
