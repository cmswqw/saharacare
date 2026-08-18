"use client";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { const { t } = useApp(); return <main className="grid min-h-screen place-items-center px-5"><div className="surface max-w-lg p-8 text-center"><CircleAlert className="mx-auto h-16 w-16 text-danger" /><h1 className="mt-5 text-3xl font-extrabold">{t("somethingWentWrong")}</h1><p className="mt-3 text-lg text-muted">{t("errorPageHelp")}</p><Button className="mt-6" size="large" onClick={reset}><RotateCcw />{t("tryAgain")}</Button></div></main>; }
