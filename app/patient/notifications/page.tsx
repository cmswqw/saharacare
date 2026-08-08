import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { DataErrorState } from "@/components/ui/DataState";
import { getNotificationsForCurrentUser } from "@/lib/data/notifications";

export default async function NotificationsPage() {
  const result = await getNotificationsForCurrentUser();

  if (result.error) {
    return <DataErrorState message="Notifications are temporarily unavailable." />;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Your updates</p>
        <h1 className="patient-heading mt-2">Notifications</h1>
        <p className="mt-3 text-lg text-muted">Permanent medication updates stored securely in SaharaCare.</p>
      </div>
      <NotificationCenter notifications={result.data} />
    </div>
  );
}
