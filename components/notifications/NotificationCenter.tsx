import { BellOff } from "lucide-react";
import { NotificationGroup } from "@/components/notifications/NotificationGroup";
import { Card } from "@/components/ui/Card";
import { getTodayBounds } from "@/lib/dose-config";
import type { AppNotification } from "@/types";

export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
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
        <h2 className="mt-4 text-2xl font-extrabold">There are no medication notifications.</h2>
        <p className="mt-2 text-lg text-muted">New taken, late, and missed updates will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <NotificationGroup title="Today" items={today} />
      <NotificationGroup title="Earlier" items={earlier} />
    </div>
  );
}
