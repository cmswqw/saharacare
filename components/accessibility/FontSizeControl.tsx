"use client";
import { useApp } from "@/components/providers/AppProvider";
import { textSizes } from "@/constants/accessibility";
import { cn } from "@/lib/utils";

export function FontSizeControl() { const { textSize, setTextSize, t } = useApp(); return <div className="grid grid-cols-3 gap-3">{textSizes.map((item, index) => <button type="button" key={item.value} onClick={() => setTextSize(item.value)} className={cn("min-h-20 rounded-2xl border-2 bg-card p-3 font-bold", textSize === item.value ? "border-primary bg-blue-50 text-primary dark:bg-blue-950/40" : "border-border")} aria-pressed={textSize === item.value}><span className={index === 0 ? "text-xl" : index === 1 ? "text-2xl" : "text-3xl"}>{item.preview}</span><span className="mt-1 block text-sm">{t(item.labelKey)}</span></button>)}</div>; }
