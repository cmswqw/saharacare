import type { MedicalKyc } from "@/lib/medical-kyc/types";

export function createMedicalKycId() {
  return crypto.randomUUID();
}

export function createEmptyMedicalKyc(fullName = ""): MedicalKyc {
  return {
    version: "1.0",
    patientBasics: {
      fullName,
      dateOfBirth: "",
      bloodGroup: "",
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactPhone: "",
    },
    allergies: { answer: "not_sure", entries: [] },
    currentConditions: { answer: "not_sure", entries: [] },
    currentMedications: { answer: "not_sure", entries: [] },
    medicalHistory: { answer: "not_sure", entries: [] },
    surgeries: { answer: "not_sure", entries: [] },
    facilityHistory: { answer: "not_sure", entries: [] },
    familyHistory: { answer: "unknown", conditions: [], other: "" },
    otherInformation: "",
  };
}
