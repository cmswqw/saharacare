import "server-only";
import { eligiblePromotions, type HospitalPromotion } from "./policy";

// Authorized repository maintainers manage approved factual content via review.
// Do not add real advertisements without hospital approval and legal review.
const approvedPromotions: HospitalPromotion[] = [];
export function getHospitalPromotions() {
  const demo = process.env.HOSPITAL_PROMOTIONS_DEMO === "true" && (process.env.NODE_ENV === "development"
    || process.env.HOSPITAL_PROMOTIONS_ALLOW_PRODUCTION_DEMO === "true");
  return eligiblePromotions(demo ? ["a", "b", "c"].map((id, index) => ({
    id: `demo-${id}`, hospitalName: `DEMO Hospital ${id.toUpperCase()} — fictional`,
    description: "DEMO only. Not a real hospital, offer or endorsement. No booking or payment is processed.",
    imageUrl: "/promotions/demo.svg", imageAlt: "Fictional hospital promotion sample",
    destinationUrl: process.env.HOSPITAL_PROMOTIONS_DEMO_URL ?? "https://example.invalid/saharacare-demo", isActive: true, priority: 3 - index,
    galleryImages: [{ imageUrl: "/promotions/demo.svg", alt: "Fictional sample artwork" }],
  })) : approvedPromotions);
}
