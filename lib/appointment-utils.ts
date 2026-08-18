import type { TranslationKey } from "@/lib/i18n";

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
