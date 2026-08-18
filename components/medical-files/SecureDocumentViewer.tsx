"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";

export function SecureDocumentViewer({ url, mimeType, label }: { url: string; mimeType: string; label: string }) {
  const { t } = useApp();
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(mimeType === "application/pdf");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mimeType !== "application/pdf" || !container.current) return;
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    const target = container.current;
    target.replaceChildren();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url, withCredentials: true });
        loadingTask = task;
        const document = await task.promise;
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (cancelled) break;
          const page = await document.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = window.document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto mb-4 h-auto max-w-full rounded-xl bg-white shadow-soft";
          canvas.setAttribute("aria-label", t("documentPage", { label, page: pageNumber }));
          canvas.oncontextmenu = (event) => event.preventDefault();
          target.appendChild(canvas);
          const context2d = canvas.getContext("2d");
          if (!context2d) throw new Error("A PDF page could not be rendered.");
          await page.render({ canvas, canvasContext: context2d, viewport }).promise;
          page.cleanup();
        }
        await document.destroy();
      } catch {
        if (!cancelled) setError(t("pdfDisplayError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      target.replaceChildren();
    };
  }, [label, mimeType, t, url]);

  if (mimeType !== "application/pdf") return <div className="overflow-hidden rounded-2xl border bg-slate-100 p-3" onContextMenu={(event) => event.preventDefault()}><Image src={url} alt={label} width={1400} height={1800} unoptimized draggable={false} className="mx-auto h-auto max-h-[75vh] w-auto max-w-full rounded-xl object-contain" /></div>;
  return <div className="relative min-h-48 rounded-2xl border bg-slate-200 p-3 dark:bg-slate-900"><div ref={container} />{loading ? <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/80"><span className="flex items-center gap-3 font-bold"><LoaderCircle className="animate-spin" />{t("renderingPdf")}</span></div> : null}{error ? <p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}</div>;
}
