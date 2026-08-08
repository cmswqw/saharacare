"use client";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="grid min-h-screen place-items-center px-5"><div className="surface max-w-lg p-8 text-center"><CircleAlert className="mx-auto h-16 w-16 text-danger" /><h1 className="mt-5 text-3xl font-extrabold">Something went wrong</h1><p className="mt-3 text-lg text-muted">Your demo data is safe. Please try loading this view again.</p><Button className="mt-6" size="large" onClick={reset}><RotateCcw />Try again</Button></div></main>; }
