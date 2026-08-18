import { AppShell } from "@/components/layout/AppShell";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { MedicalKycProvider } from "@/components/providers/MedicalKycProvider";
import { requireRole } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/data/notifications";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const [profile, notifications] = await Promise.all([
    requireRole("patient"),
    getUnreadNotificationCount(),
  ]);

  return (
    <CurrentUserProvider profile={profile}>
      <MedicalKycProvider>
        <AppShell mode="patient" unreadNotifications={notifications.data}>{children}</AppShell>
      </MedicalKycProvider>
    </CurrentUserProvider>
  );
}
