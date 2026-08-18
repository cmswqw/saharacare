export type ThreeStateAnswer = "yes" | "no" | "not_sure";

export type AllergyEntry = {
  id: string;
  type: string;
  name: string;
  reaction: string;
  severity: string;
};

export type ConditionEntry = {
  id: string;
  name: string;
  other: string;
};

export type KycMedicationEntry = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  reason: string;
  note: string;
};

export type MedicalHistoryEntry = {
  id: string;
  condition: string;
  date: string;
  treatment: string;
  details: string;
};

export type SurgeryEntry = {
  id: string;
  procedure: string;
  date: string;
  hospital: string;
  details: string;
};

export type FacilityHistoryEntry = {
  id: string;
  facility: string;
  date: string;
  reason: string;
  doctor: string;
  note: string;
};

export type FamilyHistoryAnswer = "provided" | "unknown" | "prefer_not_to_answer";

export type MedicalKyc = {
  version: "1.0";
  patientBasics: {
    fullName: string;
    dateOfBirth: string;
    bloodGroup: string;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
  };
  allergies: {
    answer: ThreeStateAnswer;
    entries: AllergyEntry[];
  };
  currentConditions: {
    answer: ThreeStateAnswer;
    entries: ConditionEntry[];
  };
  currentMedications: {
    answer: ThreeStateAnswer;
    entries: KycMedicationEntry[];
  };
  medicalHistory: {
    answer: ThreeStateAnswer;
    entries: MedicalHistoryEntry[];
  };
  surgeries: {
    answer: ThreeStateAnswer;
    entries: SurgeryEntry[];
  };
  facilityHistory: {
    answer: ThreeStateAnswer;
    entries: FacilityHistoryEntry[];
  };
  familyHistory: {
    answer: FamilyHistoryAnswer;
    conditions: string[];
    other: string;
  };
  otherInformation: string;
};

export type MedicalSummarySection = {
  title: string;
  lines: string[];
};
