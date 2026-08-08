"use client";

import Link from "next/link";
import { ArrowLeft, BellRing, Contrast, Languages, Moon, Smartphone, Volume2 } from "lucide-react";
import { DemoTools } from "@/components/demo/DemoTools";
import { useApp } from "@/components/providers/AppProvider";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { FontSizeControl } from "@/components/accessibility/FontSizeControl";
import { ReadAloudButton } from "@/components/accessibility/ReadAloudButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-9 w-16 shrink-0 rounded-full p-1 transition-colors ${checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <span className={`block h-7 w-7 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-7" : "translate-x-0"}`} />
    </button>
  );
}

function SettingRow({
  icon: Icon,
  title,
  detail,
  control,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950"><Icon /></span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-extrabold">{title}</p>
        <p className="mt-1 text-sm text-muted">{detail}</p>
      </div>
      {control}
    </div>
  );
}

export default function SettingsPage() {
  const app = useApp();
  const profile = useCurrentUser();
  const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function testBrowserNotification() {
    if (!("Notification" in window)) {
      app.toast("Browser notifications are unavailable here.", "warning");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("SaharaCare demo", { body: "Sample reminder preview." });
    }
    app.toast(
      permission === "granted"
        ? "Sample browser notification sent."
        : "Notification permission was not granted.",
      permission === "granted" ? "success" : "warning",
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href={profile.role === "caregiver" ? "/caregiver" : "/patient"} className="grid h-12 w-12 place-items-center rounded-2xl border bg-card" aria-label="Back"><ArrowLeft /></Link>
          <p className="font-extrabold text-primary">SaharaCare</p>
          <span className="text-sm font-bold text-muted">Settings</span>
        </div>

        <header className="mt-10">
          <p className="eyebrow">Comfort & reminders</p>
          <h1 className="patient-heading mt-2">{app.t("settings")}</h1>
          <p className="mt-3 text-lg text-muted">Choose what feels easiest to see and use.</p>
        </header>

        <div className="mt-8 space-y-6">
          <Card className="p-5 md:p-6">
            <div className="flex items-center gap-3"><Languages className="text-primary" /><h2 className="text-2xl font-extrabold">{app.t("language")}</h2></div>
            <div className="mt-5"><LanguageToggle /></div>
          </Card>

          <Card className="p-5 md:p-6">
            <h2 className="text-2xl font-extrabold">{app.t("textSize")}</h2>
            <div className="mt-5"><FontSizeControl /></div>
          </Card>

          <Card className="divide-y px-5 md:px-6">
            <SettingRow icon={Moon} title={app.t("darkMode")} detail="Use a dark background in low light." control={<Toggle checked={app.darkMode} onChange={app.setDarkMode} label="Toggle dark mode" />} />
            <SettingRow icon={Contrast} title={app.t("highContrast")} detail="Use stronger borders and text contrast." control={<Toggle checked={app.highContrast} onChange={app.setHighContrast} label="Toggle high contrast" />} />
            <SettingRow icon={Smartphone} title={app.t("reducedMotion")} detail="Limit interface movement and animation." control={<Toggle checked={app.reducedMotion} onChange={app.setReducedMotion} label="Toggle reduced motion" />} />
          </Card>

          <Card className="p-5 md:p-6">
            <div className="flex items-center gap-3"><BellRing className="text-primary" /><h2 className="text-2xl font-extrabold">{app.t("reminderSettings")}</h2></div>
            <div className="mt-4 divide-y">
              <SettingRow icon={BellRing} title="Medicine reminders" detail="Reminder automation is planned for a later phase." control={<Toggle checked onChange={() => app.toast("Reminder automation is not connected yet.")} label="Toggle medicine reminders" />} />
              <SettingRow icon={Volume2} title={app.t("reminderSound")} detail="Optional soft sound preference." control={<Toggle checked={app.reminderSound} onChange={app.setReminderSound} label="Toggle reminder sound" />} />
            </div>
            <Button size="large" variant="secondary" className="mt-5" onClick={testBrowserNotification}>Allow sample browser notification</Button>
            <p className="mt-4 text-sm leading-relaxed text-muted">Sample notification only. Medication reminder scheduling belongs to a later phase.</p>
          </Card>

          <Card className="p-5 md:p-6">
            <h2 className="text-2xl font-extrabold">Accessibility</h2>
            <div className="mt-5"><ReadAloudButton /></div>
          </Card>

          {demoModeEnabled && profile.role === "patient" ? <DemoTools /> : null}
        </div>
      </div>
    </main>
  );
}
