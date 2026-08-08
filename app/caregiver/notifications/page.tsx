import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { DataErrorState } from "@/components/ui/DataState";
import { getNotificationsForCurrentUser } from "@/lib/data/notifications";

export default async function CaregiverNotificationsPage() {
  const result = await getNotificationsForCurrentUser();

  if (result.error) {
    return <DataErrorState message="Caregiver notifications are temporarily unavailable." />;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Care updates</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Notifications</h1>
        <p className="mt-3 text-lg text-muted">Taken, late, and missed medication events for your linked patients.</p>
      </div>
      <NotificationCenter notifications={result.data} />
    </div>
  );
}
