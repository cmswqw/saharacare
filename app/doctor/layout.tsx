import { AppShell } from "@/components/layout/AppShell";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { requireRole } from "@/lib/auth";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("doctor");
  return <CurrentUserProvider profile={profile}><AppShell mode="doctor">{children}</AppShell></CurrentUserProvider>;
}
