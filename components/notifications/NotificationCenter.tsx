"use client";

import { BellOff } from "lucide-react";
import { NotificationGroup } from "@/components/notifications/NotificationGroup";
import { Card } from "@/components/ui/Card";
import { getTodayBounds } from "@/lib/dose-config";
import type { AppNotification } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
  const { t } = useApp();
  const { start, end } = getTodayBounds();
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const today = notifications.filter((notification) => {
    const createdAt = new Date(notification.created_at).getTime();
    return createdAt >= startTime && createdAt < endTime;
  });
  const earlier = notifications.filter((notification) => !today.includes(notification));

  if (notifications.length === 0) {
    return (
      <Card className="py-16 text-center">
        <BellOff className="mx-auto h-14 w-14 text-muted" />
        <h2 className="mt-4 text-2xl font-extrabold">{t("noNotifications")}</h2>
        <p className="mt-2 text-lg text-muted">{t("notificationEmptyHelp")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <NotificationGroup title={t("today")} items={today} />
      <NotificationGroup title={t("earlier")} items={earlier} />
    </div>
  );
}
