import type { DirectoryMatch, DirectorySpecialty } from "@/lib/directory/contracts";

export const symptomChips = ["leg_knee", "chest", "fever_cold_fatigue", "skin", "child", "other"] as const;
export type SymptomChip = typeof symptomChips[number];
export const urgencyValues = ["emergency", "urgent", "uncertain", "routine"] as const;
export const clarificationValues = ["duration", "severity", "child_age", "associated_symptoms"] as const;
export type BookingGuidance = {
  urgency: typeof urgencyValues[number];
  specialtyIds: string[];
  clarification: typeof clarificationValues[number] | null;
};
export type BookingGuidanceRequest = {
  mode: "booking_guidance";
  action: "specialties" | "guide" | "browse";
  symptoms: string;
  chip: SymptomChip | null;
  patientId: string | null;
  specialtyId: string | null;
};
export type BookingGuidanceStatus = "ready" | "emergency" | "urgent" | "clarification" | "matches" | "no_matches"
  | "directory_error" | "ai_unavailable" | "review_required" | "catalog_empty" | "invalid_request" | "denied" | "rate_limited";
export type BookingGuidanceResponse = {
  status: BookingGuidanceStatus;
  guidance: BookingGuidance | null;
  source: "rule" | "ai" | "manual" | "fallback";
  specialties: DirectorySpecialty[];
  providers: DirectoryMatch[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const slug = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value);

/** Conservative fail-safe only, not a diagnosis or a valid routine response.
 * Preserve an explicitly emitted urgent enum even when JSON/stream is cut off.
 */
export function getUrgentGuidanceSignal(text: string): "emergency" | "urgent" | null {
  let parsedSignal: "emergency" | "urgent" | null = null;
  try {
    const raw: unknown = JSON.parse(text);
    if (isObject(raw) && (raw.urgency === "emergency" || raw.urgency === "urgent")) parsedSignal = raw.urgency;
  } catch { /* A partial top-level object can still contain an escalation. */ }
  // Schema orders urgency first. Require an object/property prefix, never scan
  // arbitrary prose or nested patient text for clinical keywords.
  const match = /^\s*\{\s*"urgency"\s*:\s*"(emergency|urgent)"/u.exec(text);
  if (parsedSignal === "emergency" || match?.[1] === "emergency") return "emergency";
  return parsedSignal ?? (match ? match[1] as "urgent" : null);
}

export function parseBookingGuidanceRequest(value: unknown): BookingGuidanceRequest | null {
  if (!isObject(value) || value.mode !== "booking_guidance"
    || Object.keys(value).some(key => !["mode", "action", "symptoms", "chip", "patientId", "specialtyId"].includes(key))
    || !["specialties", "guide", "browse"].includes(String(value.action))
    || (value.symptoms !== undefined && typeof value.symptoms !== "string")
    || (typeof value.symptoms === "string" && value.symptoms.length > 2000)
    || (value.chip != null && !symptomChips.includes(value.chip as SymptomChip))
    || (value.patientId != null && (typeof value.patientId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.patientId)))
    || (value.specialtyId != null && !slug(value.specialtyId))) return null;
  const symptoms = typeof value.symptoms === "string" ? value.symptoms.trim() : "";
  if ((value.action === "guide" && !symptoms) || (value.action === "browse" && !slug(value.specialtyId))) return null;
  return { mode: "booking_guidance", action: value.action as BookingGuidanceRequest["action"], symptoms,
    chip: (value.chip ?? null) as SymptomChip | null, patientId: (value.patientId ?? null) as string | null,
    specialtyId: (value.specialtyId ?? null) as string | null };
}

/** No prose/provider fields are permitted. Fabricated IDs/extra keys fail closed. */
export function parseBookingGuidanceOutput(text: string, specialties: DirectorySpecialty[]): BookingGuidance | null {
  if (text.length > 4000) return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!isObject(raw) || Object.keys(raw).length !== 3
    || Object.keys(raw).some(key => !["urgency", "specialtyIds", "clarification"].includes(key))
    || !urgencyValues.includes(raw.urgency as BookingGuidance["urgency"])
    || !Array.isArray(raw.specialtyIds) || raw.specialtyIds.length > 3
    || new Set(raw.specialtyIds).size !== raw.specialtyIds.length
    || raw.specialtyIds.some(id => typeof id !== "string" || !specialties.some(s => s.id === id))
    || (raw.clarification !== null && !clarificationValues.includes(raw.clarification as typeof clarificationValues[number]))) return null;
  if ((raw.urgency === "emergency" || raw.urgency === "urgent") && (raw.specialtyIds.length || raw.clarification !== null)) return null;
  if (raw.urgency === "routine" && (!raw.specialtyIds.length || raw.clarification !== null)) return null;
  if (raw.urgency === "uncertain" && raw.clarification === null) return null;
  return { urgency: raw.urgency as BookingGuidance["urgency"], specialtyIds: raw.specialtyIds as string[], clarification: raw.clarification as BookingGuidance["clarification"] };
}

export function bookingGuidanceSchema(specialties: DirectorySpecialty[]): Record<string, unknown> {
  return { type: "object", additionalProperties: false, required: ["urgency", "specialtyIds", "clarification"], properties: {
    urgency: { type: "string", enum: urgencyValues },
    specialtyIds: { type: "array", maxItems: 3, items: { type: "string", enum: specialties.map(s => s.id) } },
    clarification: { anyOf: [{ type: "string", enum: clarificationValues }, { type: "null" }] },
  } };
}
