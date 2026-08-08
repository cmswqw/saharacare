import { AppShell } from "@/components/layout/AppShell";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { requireRole } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/data/notifications";

export default async function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const [profile, notifications] = await Promise.all([
    requireRole("caregiver"),
    getUnreadNotificationCount(),
  ]);

  return (
    <CurrentUserProvider profile={profile}>
      <AppShell mode="caregiver" unreadNotifications={notifications.data}>{children}</AppShell>
    </CurrentUserProvider>
  );
}
