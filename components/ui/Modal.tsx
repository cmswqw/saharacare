"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><AnimatePresence>{open ? <Dialog.Portal forceMount>
    <Dialog.Overlay asChild><motion.div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
    <Dialog.Content asChild><motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} className={cn("fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90vh] max-w-xl -translate-y-1/2 overflow-y-auto rounded-3xl border bg-card p-6 shadow-2xl md:p-8", className)}>
      <Dialog.Title className="pe-12 text-2xl font-bold">{title}</Dialog.Title>
      {description ? <Dialog.Description className="mt-2 text-base leading-relaxed text-muted">{description}</Dialog.Description> : null}
      <Dialog.Close className="absolute end-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white" aria-label="Close"><X aria-hidden="true" /></Dialog.Close>
      <div className="mt-6">{children}</div>
    </motion.div></Dialog.Content>
  </Dialog.Portal> : null}</AnimatePresence></Dialog.Root>;
}
