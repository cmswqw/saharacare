import { TranslatedText } from "@/components/ui/TranslatedText";
import Link from "next/link";

export default async function HospitalPromotionDemo({ searchParams }: { searchParams: Promise<{ details?: string }> }) {
  const details = (await searchParams).details === "1";
  return <main id={details ? "promotion-demo-information" : "main-content"} tabIndex={-1} className="mx-auto max-w-2xl space-y-6 px-5 py-12 text-lg leading-relaxed">
    <p className="font-bold text-primary"><TranslatedText translationKey="appName" /></p>
    <h1 className="text-3xl font-bold"><TranslatedText translationKey="hospitalDemoTitle" /></h1>
    <p><TranslatedText translationKey="hospitalDemoNotice" /></p>
    <p><TranslatedText translationKey={details ? "hospitalDemoDetails" : "hospitalDemoInstructions"} /></p>
    <a className="inline-flex min-h-14 items-center rounded-xl bg-primary px-5 py-3 font-bold text-white" href="/hospital-demo"><TranslatedText translationKey="hospitalDemoAgain" /></a>
    <Link className="flex min-h-14 items-center font-bold text-primary underline" href="/"><TranslatedText translationKey="appName" /></Link>
  </main>;
}
