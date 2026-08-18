"use client";

import { useActionState } from "react";
import { CheckCheck, Clock3, Pill, TriangleAlert } from "lucide-react";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/Button";
import { formatDoseDate, formatDoseTimestamp } from "@/lib/dose-config";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationActionState } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

const initialState: NotificationActionState = { status: "idle", message: "" };

const icons = {
  medication_taken: Pill,
  medication_late: Clock3,
  medication_missed: TriangleAlert,
};

export function NotificationCard({ notification }: { notification: AppNotification }) {
  const { language, t } = useApp();
  const [state, action, pending] = useActionState(markNotificationReadAction, initialState);
  const Icon = icons[notification.type];

  return (
    <article className={cn(
      "flex gap-4 rounded-3xl border p-5",
      notification.read ? "bg-card" : "border-blue-200 bg-blue-50 dark:bg-blue-950/30",
    )}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-card text-primary shadow-sm">
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold">{notification.title}</h3>
          {!notification.read ? (
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{t("unread")}</span>
          ) : null}
        </div>
        <p className="mt-2 text-base leading-relaxed text-muted">{notification.message}</p>
        <p className="mt-2 text-sm font-semibold text-muted">
          {formatDoseDate(notification.created_at, language)} · {formatDoseTimestamp(notification.created_at, language)}
        </p>
        {!notification.read ? (
          <form action={action} className="mt-3">
            <input type="hidden" name="notification_id" value={notification.id} />
            <Button type="submit" variant="ghost" disabled={pending}>
              <CheckCheck />{t(pending ? "saving" : "markRead")}
            </Button>
          </form>
        ) : null}
        {state.status === "error" ? (
          <p className="mt-2 text-sm font-bold text-danger" role="alert">{language === "ne" ? t("notificationUpdateError") : state.message}</p>
        ) : null}
      </div>
    </article>
  );
}
