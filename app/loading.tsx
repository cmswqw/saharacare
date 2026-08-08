import { Skeleton } from "@/components/ui/Skeleton";
export default function Loading() { return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-72 w-full" /><div className="grid gap-5 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div></main>; }
