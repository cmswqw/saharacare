"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";

export function Toast({ state }: { state: { message: string; tone?: "success" | "info" | "warning" } | null }) {
  const Icon = state?.tone === "success" ? CheckCircle2 : state?.tone === "warning" ? TriangleAlert : Info;
  return <AnimatePresence>{state ? <motion.div role="status" aria-live="polite" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-28 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-base font-bold text-white shadow-2xl md:bottom-8"><Icon className="h-6 w-6 shrink-0 text-green-400" />{state.message}</motion.div> : null}</AnimatePresence>;
}
