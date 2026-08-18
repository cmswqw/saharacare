import type {
  MedicalKyc,
  MedicalSummarySection,
  ThreeStateAnswer,
} from "@/lib/medical-kyc/types";

const answerLabels: Record<ThreeStateAnswer, string> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
};

function valueOrNotProvided(value: string) {
  return value.trim() || "Not provided";
}

function listedAnswer(answer: ThreeStateAnswer, lines: string[]) {
  if (answer === "no") return ["No"];
  if (answer === "not_sure") return ["Unknown / not sure"];
  return lines.length > 0 ? lines : ["Yes - details not provided"];
}

export function buildMedicalSummarySections(kyc: MedicalKyc): MedicalSummarySection[] {
  const basics = kyc.patientBasics;

  return [
    {
      title: "1. Patient basics",
      lines: [
        `Full name: ${valueOrNotProvided(basics.fullName)}`,
        `Date of birth: ${valueOrNotProvided(basics.dateOfBirth)}`,
        `Blood group: ${valueOrNotProvided(basics.bloodGroup)}`,
        `Emergency contact: ${valueOrNotProvided(basics.emergencyContactName)}`,
        `Relationship: ${valueOrNotProvided(basics.emergencyContactRelationship)}`,
        `Emergency phone: ${valueOrNotProvided(basics.emergencyContactPhone)}`,
      ],
    },
    {
      title: "2. Allergies",
      lines: listedAnswer(kyc.allergies.answer, kyc.allergies.entries.map((entry, index) => (
        `${index + 1}. ${valueOrNotProvided(entry.name)}; type: ${valueOrNotProvided(entry.type)}; reaction: ${valueOrNotProvided(entry.reaction)}; severity: ${valueOrNotProvided(entry.severity)}`
      ))),
    },
    {
      title: "3. Current conditions",
      lines: listedAnswer(kyc.currentConditions.answer, kyc.currentConditions.entries.map((entry, index) => (
        `${index + 1}. ${entry.name === "Other" ? valueOrNotProvided(entry.other) : valueOrNotProvided(entry.name)}`
      ))),
    },
    {
      title: "4. Current medications",
      lines: listedAnswer(kyc.currentMedications.answer, kyc.currentMedications.entries.map((entry, index) => (
        `${index + 1}. ${valueOrNotProvided(entry.name)}; dosage: ${valueOrNotProvided(entry.dosage)}; frequency: ${valueOrNotProvided(entry.frequency)}; reason: ${valueOrNotProvided(entry.reason)}; note: ${valueOrNotProvided(entry.note)}`
      ))),
    },
    {
      title: "5. Medical history",
      lines: listedAnswer(kyc.medicalHistory.answer, kyc.medicalHistory.entries.map((entry, index) => (
        `${index + 1}. ${valueOrNotProvided(entry.condition)}; date: ${valueOrNotProvided(entry.date)}; treatment: ${valueOrNotProvided(entry.treatment)}; details: ${valueOrNotProvided(entry.details)}`
      ))),
    },
    {
      title: "6. Surgeries and procedures",
      lines: listedAnswer(kyc.surgeries.answer, kyc.surgeries.entries.map((entry, index) => (
        `${index + 1}. ${valueOrNotProvided(entry.procedure)}; date: ${valueOrNotProvided(entry.date)}; hospital: ${valueOrNotProvided(entry.hospital)}; details: ${valueOrNotProvided(entry.details)}`
      ))),
    },
    {
      title: "7. Hospital and clinic history",
      lines: listedAnswer(kyc.facilityHistory.answer, kyc.facilityHistory.entries.map((entry, index) => (
        `${index + 1}. ${valueOrNotProvided(entry.facility)}; date: ${valueOrNotProvided(entry.date)}; reason: ${valueOrNotProvided(entry.reason)}; doctor: ${valueOrNotProvided(entry.doctor)}; note: ${valueOrNotProvided(entry.note)}`
      ))),
    },
    {
      title: "8. Family history",
      lines: kyc.familyHistory.answer === "unknown"
        ? ["Unknown"]
        : kyc.familyHistory.answer === "prefer_not_to_answer"
          ? ["Prefer not to answer"]
          : [
              ...(kyc.familyHistory.conditions.length > 0
                ? kyc.familyHistory.conditions
                : ["No listed family conditions provided"]),
              ...(kyc.familyHistory.other.trim()
                ? [`Other: ${kyc.familyHistory.other.trim()}`]
                : []),
            ],
    },
    {
      title: "9. Other information",
      lines: [valueOrNotProvided(kyc.otherInformation)],
    },
    {
      title: "Patient confirmation",
      lines: [
        "This summary was created from information entered and reviewed by the patient.",
        "It is not a diagnosis and does not replace professional medical advice.",
        `Questionnaire completion status: ${answerLabels[kyc.allergies.answer] ? "Patient reviewed" : "Not reviewed"}`,
      ],
    },
  ];
}
