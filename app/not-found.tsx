import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TranslatedText } from "@/components/ui/TranslatedText";
export default function NotFound() { return <main className="grid min-h-screen place-items-center px-5"><div className="surface max-w-lg p-8 text-center"><p className="eyebrow">404</p><h1 className="mt-3 text-3xl font-extrabold"><TranslatedText translationKey="pageNotFound" /></h1><p className="mt-3 text-lg text-muted"><TranslatedText translationKey="pageNotFoundHelp" /></p><Button asChild className="mt-6" size="large"><Link href="/patient"><Home /><TranslatedText translationKey="goHome" /></Link></Button></div></main>; }
