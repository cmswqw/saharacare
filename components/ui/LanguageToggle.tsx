"use client";
import { Languages } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";

export function LanguageToggle() {
  const { language, setLanguage, t } = useApp();
  return <div className="inline-flex min-h-12 items-center gap-1 rounded-2xl border bg-card p-1" aria-label={t("chooseLanguage")}><Languages className="ms-2 h-5 w-5 text-primary" aria-hidden="true" /><button type="button" onClick={() => setLanguage("ne")} className={`rounded-xl px-3 py-2 text-base font-bold ${language === "ne" ? "bg-primary text-white" : "text-muted"}`} aria-pressed={language === "ne"}>नेपाली</button><button type="button" onClick={() => setLanguage("en")} className={`rounded-xl px-3 py-2 text-base font-bold ${language === "en" ? "bg-primary text-white" : "text-muted"}`} aria-pressed={language === "en"}>English</button></div>;
}
