import type { AppNotification } from "@/types";
import { NotificationCard } from "./NotificationCard";
export function NotificationGroup({ title, items }: { title: string; items: AppNotification[] }) { if (!items.length) return null; return <section><h2 className="mb-4 text-2xl font-extrabold">{title}</h2><div className="space-y-4">{items.map((item) => <NotificationCard key={item.id} notification={item} />)}</div></section>; }
