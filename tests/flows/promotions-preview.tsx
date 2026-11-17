import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "@/components/providers/AppProvider";
import { HospitalPromotionHost } from "@/components/promotions/HospitalPromotionHost";
import { presentLaunchPromotion } from "@/lib/promotions/launch";
const params = new URLSearchParams(location.search);
try { localStorage.setItem("saharacare-language", params.get("lang") === "ne" ? "ne" : "en"); } catch { /* test denied storage */ }
const records = ["a", "b", "c"].map((id, index) => ({ id, hospitalName: `DEMO Hospital ${id.toUpperCase()} — fictional`,
  description: "Development sample only; no real offer or endorsement.", imageUrl: params.has("broken") ? "/promotions/missing.svg" : "/promotions/demo.svg",
  destinationUrl: "https://example.invalid/saharacare-demo", priority: 3 - index, isActive: true,
  galleryImages: [{ imageUrl: "/promotions/demo.svg", alt: "Fictional gallery sample" }],
}));
function Preview() {
  const [version, setVersion] = useState(0);
  return <AppProvider><main id="main-content" tabIndex={-1} className="min-h-screen p-4"><h1>SaharaCare development preview</h1>
    <button onClick={() => setVersion(n => n + 1)}>Remount</button><a href="#other">Navigate</a>
    <HospitalPromotionHost key={version} promotions={params.has("empty") ? [] : records} />
  </main></AppProvider>;
}
if (params.has("slow")) {
  document.getElementById("root")!.innerHTML = '<main id="main-content" tabindex="-1"><button>Continue</button></main>';
  let resolve: (value: unknown) => void, reject: (reason: unknown) => void;
  const data = new Promise((done, fail) => { resolve = done; reject = fail; });
  Object.assign(window, { resolvePromotions: () => resolve(records), rejectPromotions: () => reject(Error("Synthetic outage")), launchShown: false });
  presentLaunchPromotion(document, () => data, (_, appeared) => { appeared(); Object.assign(window, { launchShown: true }); });
} else createRoot(document.getElementById("root")!).render(<StrictMode><Preview /></StrictMode>);
