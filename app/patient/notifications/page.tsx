import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { DataErrorState } from "@/components/ui/DataState";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { getNotificationsForCurrentUser } from "@/lib/data/notifications";

export default async function NotificationsPage() {
  const result = await getNotificationsForCurrentUser();

  if (result.error) {
    return <DataErrorState messageKey="notificationsError" />;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow"><TranslatedText translationKey="yourUpdates" /></p>
        <h1 className="patient-heading mt-2"><TranslatedText translationKey="notifications" /></h1>
        <p className="mt-3 text-lg text-muted"><TranslatedText translationKey="patientNotificationsIntro" /></p>
      </div>
      <NotificationCenter notifications={result.data} />
    </div>
  );
}
