export type HospitalPromotion = {
  id: string; hospitalName: string; description?: string; promotionalMessage?: string;
  imageUrl: string; imageAlt?: string; galleryImages?: { imageUrl: string; alt?: string }[];
  destinationUrl: string; location?: string; isActive: boolean; priority: number;
};

export const rotationKey = "saharacare-hospital-promotion-v1";
export function safeDestination(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
function safeImage(value: unknown): value is string {
  return typeof value === "string" && (/^\/promotions\/[a-zA-Z0-9_.-]+$/.test(value) || safeDestination(value));
}
const short = (value: unknown, length: number): value is string => typeof value === "string" && !!value.trim() && value.length <= length;
export function eligiblePromotions(records: unknown): HospitalPromotion[] {
  if (!Array.isArray(records)) return [];
  const ids = new Set<string>();
  return records.slice(0, 100).flatMap((record: unknown) => {
    if (!record || typeof record !== "object") return [];
    const p = record as HospitalPromotion;
    if (!short(p.id, 100) || ids.has(p.id) || !short(p.hospitalName, 150) || p.isActive !== true
      || !Number.isFinite(p.priority) || !safeImage(p.imageUrl) || !safeDestination(p.destinationUrl)
      || [p.description, p.promotionalMessage, p.location, p.imageAlt].some(value => value !== undefined && !short(value, 600))) return [];
    ids.add(p.id);
    return [{ id: p.id, hospitalName: p.hospitalName, imageUrl: p.imageUrl, destinationUrl: p.destinationUrl,
      isActive: true, priority: p.priority, description: p.description, promotionalMessage: p.promotionalMessage,
      location: p.location, imageAlt: p.imageAlt,
      galleryImages: Array.isArray(p.galleryImages) ? p.galleryImages.slice(0, 6).filter(image => image && safeImage(image.imageUrl) && (image.alt === undefined || short(image.alt, 600))).map(image => ({ imageUrl: image.imageUrl, alt: image.alt })) : [],
    }];
  }).sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function nextPromotion(records: HospitalPromotion[], last: string | null) {
  if (!records.length) return null;
  const index = records.findIndex(p => p.id === last);
  return records[(index + 1) % records.length];
}
export function readRotation(storage: Pick<Storage, "getItem">): string | null {
  try { const value: unknown = JSON.parse(storage.getItem(rotationKey) ?? "null"); return short(value, 100) ? value : null; } catch { return null; }
}
export function writeRotation(storage: Pick<Storage, "setItem">, id: string) {
  try { storage.setItem(rotationKey, JSON.stringify(id)); } catch { /* Storage is optional. */ }
}
