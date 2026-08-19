"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, LoaderCircle, Volume2 } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import {
  MEDICATION_REMINDER_LEAD_MINUTES,
  PUSH_SERVICE_WORKER_PATH,
  urlBase64ToUint8Array,
} from "@/lib/notifications/config";
import type { Language } from "@/types";

type ReminderState = "checking" | "ready" | "enabled" | "blocked" | "unsupported" | "unconfigured" | "error";
const soundStorageKey = "saharacare-reminder-sound";

function supportsPush() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

function serializedSubscription(subscription: PushSubscription) {
  const value = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: value.keys?.p256dh ?? "",
      auth: value.keys?.auth ?? "",
    },
  };
}

async function persistSubscription(subscription: PushSubscription, language: Language, soundEnabled: boolean) {
  const response = await fetch("/api/push-subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...serializedSubscription(subscription),
      language,
      soundEnabled,
    }),
  });
  if (!response.ok) throw new Error("push_subscription_save_failed");
}

export function PushReminderSettings() {
  const { language, t, toast } = useApp();
  const [state, setState] = useState<ReminderState>("checking");
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    let active = true;

    async function inspect() {
      const savedSound = localStorage.getItem(soundStorageKey);
      const nextSound = savedSound !== "off";
      if (active) setSoundEnabled(nextSound);

      if (!supportsPush()) {
        if (active) setState("unsupported");
        return;
      }
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        if (active) setState("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("blocked");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!active) return;
      if (subscription && Notification.permission === "granted") {
        await persistSubscription(subscription, language, nextSound);
        if (active) setState("enabled");
      } else {
        setState("ready");
      }
    }

    void inspect().catch(() => active && setState("error"));
    return () => { active = false; };
  }, [language]);

  async function saveSubscription(subscription: PushSubscription, sound: boolean, showToast: boolean) {
    await persistSubscription(subscription, language, sound);
    if (showToast) toast(t("notificationsEnabled"), "success");
  }

  async function enableNotifications() {
    if (busy || !supportsPush()) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setState("unconfigured");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") {
        setState("ready");
        toast(t("notificationPermissionDismissed"), "warning");
        return;
      }

      await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH, { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await saveSubscription(subscription, soundEnabled, true);
      setState("enabled");
    } catch {
      setState("error");
      toast(t("notificationSubscriptionError"), "warning");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (busy || !supportsPush()) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("push_subscription_delete_failed");
        await subscription.unsubscribe();
      }
      setState("ready");
      toast(t("notificationsDisabled"), "info");
    } catch {
      setState("error");
      toast(t("notificationSubscriptionError"), "warning");
    } finally {
      setBusy(false);
    }
  }

  async function updateSound(nextValue: boolean) {
    setSoundEnabled(nextValue);
    localStorage.setItem(soundStorageKey, nextValue ? "on" : "off");
    if (state !== "enabled" || !supportsPush()) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await saveSubscription(subscription, nextValue, false);
    } catch {
      toast(t("notificationSubscriptionError"), "warning");
    }
  }

  async function showTestNotification() {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("SaharaCare", {
      body: t("privateReminderBody"),
      tag: "saharacare-test-reminder",
      data: { url: "/patient" },
      silent: !soundEnabled,
    });
  }

  const enabled = state === "enabled";
  const statusKey = state === "enabled"
    ? "notificationStatusEnabled"
    : state === "blocked"
      ? "notificationStatusBlocked"
      : state === "unsupported"
        ? "notificationStatusUnsupported"
        : state === "unconfigured"
          ? "notificationStatusUnconfigured"
          : state === "error"
            ? "notificationStatusError"
            : "notificationStatusReady";

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${enabled ? "bg-green-50 text-success dark:bg-green-950/30" : "bg-blue-50 text-primary dark:bg-blue-950"}`}>
          {enabled ? <BellRing aria-hidden="true" /> : <BellOff aria-hidden="true" />}
        </span>
        <div>
          <h2 className="text-2xl font-extrabold">{t("medicationNotifications")}</h2>
          <p className="mt-2 leading-relaxed text-muted">{t("medicationNotificationsHelp", { minutes: MEDICATION_REMINDER_LEAD_MINUTES })}</p>
        </div>
      </div>

      <div className={`mt-5 rounded-2xl border p-4 font-semibold ${state === "blocked" || state === "error" || state === "unconfigured" ? "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100" : "bg-slate-50 text-muted dark:bg-slate-900"}`} role="status">
        {state === "checking" ? t("checkingNotificationStatus") : t(statusKey)}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {enabled ? (
          <Button type="button" variant="secondary" size="large" onClick={disableNotifications} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <BellOff />}{t("disableNotifications")}
          </Button>
        ) : (
          <Button type="button" size="large" onClick={enableNotifications} disabled={busy || state === "unsupported" || state === "blocked" || state === "unconfigured"}>
            {busy ? <LoaderCircle className="animate-spin" /> : <BellRing />}{t("enableNotifications")}
          </Button>
        )}
        {enabled ? <Button type="button" variant="secondary" size="large" onClick={showTestNotification}>{t("sendTestNotification")}</Button> : null}
      </div>

      <div className="mt-6 flex items-center gap-4 border-t pt-5">
        <Volume2 className="shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="font-extrabold">{t("reminderSound")}</p><p className="mt-1 text-sm text-muted">{t("notificationSoundSystemHelp")}</p></div>
        <Switch checked={soundEnabled} onChange={updateSound} disabled={busy} label={t("toggleNotificationSound")} />
      </div>
    </Card>
  );
}
