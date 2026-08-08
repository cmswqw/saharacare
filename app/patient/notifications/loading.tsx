import { Skeleton } from "@/components/ui/Skeleton";
export default function NotificationsLoading() { return <div><Skeleton className="h-12 w-64" /><div className="mt-8 space-y-4">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-36 w-full" />)}</div></div>; }
