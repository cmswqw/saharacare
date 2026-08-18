"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProvider";

export function Modal({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  const { t } = useApp();
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><AnimatePresence>{open ? <Dialog.Portal forceMount>
    <Dialog.Overlay asChild><motion.div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center p-2 sm:p-4">
    <Dialog.Content asChild><motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} className={cn("pointer-events-auto grid max-h-[calc(100dvh-1rem)] min-w-0 w-full max-w-xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)]", className)}>
      <div className="relative border-b px-5 py-5 pe-16 sm:px-6 sm:py-6 sm:pe-20 md:px-8 md:pe-20">
        <Dialog.Title className="text-2xl font-bold">{title}</Dialog.Title>
        {description ? <Dialog.Description className="mt-2 text-base leading-relaxed text-muted">{description}</Dialog.Description> : null}
        <Dialog.Close className="absolute end-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 dark:bg-slate-800 dark:text-white" aria-label={t("close")}><X aria-hidden="true" /></Dialog.Close>
      </div>
      <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">{children}</div>
    </motion.div></Dialog.Content>
    </div>
  </Dialog.Portal> : null}</AnimatePresence></Dialog.Root>;
}
