import { eligiblePromotions, nextPromotion, readRotation, writeRotation, type HospitalPromotion } from "./policy";

// Document identity = full load/reload, not a route or component mount. WeakMap
// avoids sharing launch state between users during server rendering.
const launches = new WeakMap<Document, { finished: boolean }>();
export function presentLaunchPromotion(doc: Document, load: () => Promise<unknown>, show: (p: HospitalPromotion, appeared: () => void) => void) {
  let state = launches.get(doc);
  if (!state) { state = { finished: false }; launches.set(doc, state); }
  const launch = state;
  if (launch.finished) return () => {};
  let stopped = false, started = false, data: HospitalPromotion[] | null = null;
  let launchPath = "";
  let frame = 0;
  const win = doc.defaultView;
  if (!win) return () => {};
  const stop = () => { stopped = true; win.cancelAnimationFrame(frame); observer.disconnect(); for (const event of events) doc.removeEventListener(event, interacted, true); win.removeEventListener("pagehide", interacted); };
  const interacted = () => { launch.finished = true; stop(); };
  const events = ["pointerdown", "keydown", "touchstart", "wheel"];
  function attempt() {
    if (stopped || launch.finished || !doc.getElementById("main-content")) return;
    if (started && (launchPath !== win?.location.pathname || doc.visibilityState === "hidden")) { interacted(); return; }
    // Auth/onboarding pages have no AppShell main; only begin after they finish.
    if (!started) {
      started = true;
      launchPath = win?.location.pathname ?? "";
      for (const event of events) doc.addEventListener(event, interacted, { capture: true, passive: true });
      win?.addEventListener("pagehide", interacted);
      void Promise.resolve().then(load).then(raw => {
        if (stopped) return;
        if (doc.visibilityState === "hidden") { interacted(); return; }
        // Let the main screen paint and any initial blocking dialogs commit.
        // Interaction during this readiness window still skips the promotion.
        frame = win!.requestAnimationFrame(() => { frame = win!.requestAnimationFrame(() => {
          if (!stopped) { data = eligiblePromotions(raw); attempt(); }
        }); });
      }).catch(interacted);
      return;
    }
    if (!data || doc.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return;
    let last: string | null = null;
    try { last = readRotation(win!.localStorage); } catch { /* denied storage */ }
    const next = nextPromotion(data, last);
    launch.finished = true; stop();
    if (next) show(next, () => { try { writeRotation(win!.localStorage, next.id); } catch { /* denied storage */ } });
  }
  const observer = new MutationObserver(attempt);
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal"] });
  attempt();
  return stop;
}
