import "server-only";
import { eligiblePromotions, type HospitalPromotion } from "./policy";

// Authorized repository maintainers manage approved factual content via review.
// Do not add real advertisements without hospital approval and legal review.
const approvedPromotions: HospitalPromotion[] = [];
export function getHospitalPromotions() {
  const demo = process.env.NODE_ENV === "development" && process.env.HOSPITAL_PROMOTIONS_DEMO === "true";
  return eligiblePromotions(demo ? ["a", "b", "c"].map((id, index) => ({
    id: `demo-${id}`, hospitalName: `DEMO Hospital ${id.toUpperCase()} — fictional`,
    description: "Development sample only. Not a real hospital, offer or endorsement.",
    imageUrl: "/promotions/demo.svg", imageAlt: "Fictional hospital promotion sample",
    destinationUrl: "https://example.invalid/saharacare-demo", isActive: true, priority: 3 - index,
    galleryImages: [{ imageUrl: "/promotions/demo.svg", alt: "Fictional sample artwork" }],
  })) : approvedPromotions);
}
