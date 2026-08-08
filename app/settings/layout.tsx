import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { requireProfile } from "@/lib/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return <CurrentUserProvider profile={profile}>{children}</CurrentUserProvider>;
}
