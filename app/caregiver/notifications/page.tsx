import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { DataErrorState } from "@/components/ui/DataState";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { getNotificationsForCurrentUser } from "@/lib/data/notifications";

export default async function CaregiverNotificationsPage() {
  const result = await getNotificationsForCurrentUser();

  if (result.error) {
    return <DataErrorState messageKey="caregiverNotificationsError" />;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow"><TranslatedText translationKey="careUpdates" /></p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight"><TranslatedText translationKey="notifications" /></h1>
        <p className="mt-3 text-lg text-muted"><TranslatedText translationKey="caregiverNotificationsIntro" /></p>
      </div>
      <NotificationCenter notifications={result.data} />
    </div>
  );
}
