"use client";

import { startTransition, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProvider";
import { createClient } from "@/lib/supabase/client";

type NotificationPayload = {
  eventType: "INSERT" | "UPDATE";
  commit_timestamp: string;
  new: Record<string, unknown>;
};

export function NotificationRealtime({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, toast } = useApp();
  const seenEventRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const handleChange = (payload: NotificationPayload) => {
      if (payload.new.user_id !== userId || typeof payload.new.id !== "string") return;
      const notificationId = payload.new.id;
      const eventKey = `${payload.eventType}:${payload.commit_timestamp}:${String(notificationId)}`;
      if (seenEventRef.current === eventKey) return;
      seenEventRef.current = eventKey;

      const doseRealtimeHandlesRefresh = pathname === "/caregiver"
        || pathname.startsWith("/caregiver/patient/");
      if (doseRealtimeHandlesRefresh) return;
      startTransition(() => router.refresh());
    };
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        handleChange,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        handleChange,
      )
      .subscribe((status) => {
        if (!active || status !== "CHANNEL_ERROR") return;
        toast(t("liveNotificationsUnavailable"), "warning");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [pathname, router, t, toast, userId]);

  return null;
}
