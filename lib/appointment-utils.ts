import type { TranslationKey } from "@/lib/i18n";
import type { Language } from "@/types";

export const APPOINTMENT_TIME_ZONE = "Asia/Kathmandu";
export const APPOINTMENT_SLOT_MINUTES = 30;
export const APPOINTMENT_BOOKING_WINDOW_DAYS = 180;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

const purposeKeys: Record<string, TranslationKey> = {
  "Regular checkup": "reasonRegularCheckup",
  "Medicine review": "reasonMedicineReview",
  "Blood pressure check": "reasonBloodPressure",
  "Diabetes check": "reasonDiabetes",
  "Feeling unwell": "reasonUnwell",
  Other: "reasonOther",
};

export function getAppointmentPurposeKey(purpose: string) {
  return purposeKeys[purpose] ?? null;
}

export function isAppointmentUuid(value: string) {
  return uuidPattern.test(value);
}

export function isAppointmentDate(value: string) {
  return datePattern.test(value);
}

export function isAppointmentTime(value: string) {
  return timePattern.test(value);
}

export function getKathmanduDateInputValue(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APPOINTMENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((entry) => entry.type === type)?.value ?? ""
  );
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatAppointmentDate(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    timeZone: APPOINTMENT_TIME_ZONE,
    dateStyle: "long",
  }).format(new Date(iso));
}

export function formatAppointmentTime(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    timeZone: APPOINTMENT_TIME_ZONE,
    timeStyle: "short",
  }).format(new Date(iso));
}
