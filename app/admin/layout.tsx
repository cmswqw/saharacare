import { AppShell } from "@/components/layout/AppShell";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");

  return (
    <CurrentUserProvider profile={profile}>
      <AppShell mode="admin">{children}</AppShell>
    </CurrentUserProvider>
  );
}
