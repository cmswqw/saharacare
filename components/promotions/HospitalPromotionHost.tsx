"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";
import { presentLaunchPromotion } from "@/lib/promotions/launch";
import type { HospitalPromotion } from "@/lib/promotions/policy";

function Artwork({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative aspect-[4/3] w-full rounded-xl bg-surface-mint">
    {failed ? <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xl font-bold text-primary">SaharaCare<br />{alt}</div>
      : <Image src={src} alt={alt} fill unoptimized sizes="(max-width: 640px) 90vw, 480px" referrerPolicy="no-referrer" className="object-contain" onError={() => setFailed(true)} />}
  </div>;
}
export function HospitalPromotionHost({ promotions }: { promotions: HospitalPromotion[] }) {
  const { t, reducedMotion } = useApp();
  const systemReducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<HospitalPromotion | null>(null);
  const [open, setOpen] = useState(false);
  const [gallery, setGallery] = useState(0);
  const appeared = useRef<() => void>(() => {});
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => presentLaunchPromotion(document, async () => promotions, (promotion, onAppeared) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    appeared.current = onAppeared; setSelected(promotion); setOpen(true);
  }), [promotions]);
  if (!selected) return null;
  const images = [{ imageUrl: selected.imageUrl, alt: selected.imageAlt }, ...(selected.galleryImages ?? [])];
  return <Modal open={open} onOpenChange={setOpen} title={selected.hospitalName} description={t("hospitalPromotionLabel")}
    reduceMotion={reducedMotion || !!systemReducedMotion} onPresented={() => appeared.current()} onRestoreFocus={() => {
      const target = returnFocus.current?.isConnected && returnFocus.current !== document.body ? returnFocus.current : document.getElementById("main-content");
      if (target) { if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1"); target.focus(); }
    }} className="max-w-lg">
    <div className="space-y-4 text-lg leading-relaxed [overflow-wrap:anywhere]">
      <a href={selected.destinationUrl} target="_blank" rel="noopener noreferrer" aria-label={t("hospitalPromotionVisit", { name: selected.hospitalName })}>
        <Artwork key={images[gallery].imageUrl + gallery} src={images[gallery].imageUrl} alt={images[gallery].alt ?? selected.hospitalName} />
      </a>
      {images.length > 1 ? <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" type="button" onClick={() => setGallery(index => (index + images.length - 1) % images.length)}>{t("hospitalPromotionPrevious")}</Button>
        <span aria-live="polite">{t("hospitalPromotionImage", { current: gallery + 1, total: images.length })}</span>
        <Button variant="secondary" type="button" onClick={() => setGallery(index => (index + 1) % images.length)}>{t("hospitalPromotionNext")}</Button>
      </div> : null}
      {selected.description ? <p>{selected.description}</p> : null}
      {selected.promotionalMessage ? <p className="rounded-xl bg-blue-50 p-3 font-bold dark:bg-blue-950">{selected.promotionalMessage}</p> : null}
      {selected.location ? <p>{selected.location}</p> : null}
      <Button asChild className="w-full min-h-14"><a href={selected.destinationUrl} target="_blank" rel="noopener noreferrer">{t("hospitalPromotionVisit", { name: selected.hospitalName })}</a></Button>
    </div>
  </Modal>;
}
