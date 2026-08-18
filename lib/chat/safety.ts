const emergencyPatterns = [
  /\b(overdose|overdosed|poisoned|poisoning)\b/i,
  /\b(took|taken)\s+(far\s+)?too\s+(much|many)\b/i,
  /\b(can(?:not|'t)\s+breathe|difficulty breathing|trouble breathing)\b/i,
  /\b(chest pain|anaphylaxis|severe allergic reaction)\b/i,
  /\b(unconscious|not waking up|unresponsive)\b/i,
  /\b(suicidal|kill myself|end my life|self[- ]harm)\b/i,
];

const appActionPatterns = [
  /\b(mark|record)\b.{0,30}\b(dose|medicine|medication)\b.{0,20}\b(taken|complete|done)\b/i,
  /\b(add|change|update|delete|remove|stop|increase|decrease|double|halve|skip)\b.{0,30}\b(dose|dosage|medicine|medication|reminder|schedule)\b/i,
  /\b(call|contact|message|notify)\b.{0,30}\b(caregiver|doctor|clinician|hospital|pharmacist)\b/i,
];

const missedDosePattern = /\b(missed|forgot|skipped)\b.{0,30}\b(dose|medicine|medication|pill)\b|\b(dose|medicine|medication|pill)\b.{0,30}\b(missed|forgot|skipped)\b/i;

export type DeterministicSafetyReply = {
  kind: "emergency" | "app_action" | "missed_dose";
  message: string;
};

export function getDeterministicSafetyReply(
  message: string,
): DeterministicSafetyReply | null {
  if (emergencyPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "emergency",
      message:
        "This may be an emergency. Call your local emergency services now or ask someone nearby to call. Do not wait for this chat. If an overdose or poisoning may have happened, contact emergency services or a poison service immediately and keep the medicine packaging with you.",
    };
  }

  if (appActionPatterns.some((pattern) => pattern.test(message))) {
    return {
      kind: "app_action",
      message:
        "I can explain information, but I cannot change medication records, mark a dose as taken, alter reminders, or contact another person. Use SaharaCare's medication controls for record changes, and contact your caregiver or clinician directly when needed.",
    };
  }

  if (missedDosePattern.test(message)) {
    return {
      kind: "missed_dose",
      message:
        "Do not double a dose unless a qualified clinician or the medicine's official instructions specifically tell you to. Check the prescription label or patient leaflet, then contact a pharmacist or clinician for advice for this medicine. If you took too much or have severe symptoms, call local emergency services now.",
    };
  }

  return null;
}

export type ChatContextIntent = {
  needsMedicationData: boolean;
  needsTodayDoses: boolean;
  needsInstructions: boolean;
};

export function classifyChatContextIntent(message: string): ChatContextIntent {
  const medicationTerms = /\b(medicine|medicines|medication|medications|pill|pills|dose|dosage|schedule|reminder|prescription|taking|take)\b/i;
  const todayTerms = /\b(today|tonight|now|next|due|taken|late|missed|schedule|reminder|time)\b/i;
  const instructionTerms = /\b(instruction|instructions|how (?:do|should) i take|with food|after food|before food|with water)\b/i;

  return {
    needsMedicationData: medicationTerms.test(message),
    needsTodayDoses: todayTerms.test(message),
    needsInstructions: instructionTerms.test(message),
  };
}

function normalizeForMatch(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function selectRelevantMedicationIds(
  question: string,
  medications: Array<{ id: string; name: string }>,
  limit = 12,
) {
  const normalizedQuestion = ` ${normalizeForMatch(question)} `;
  const matched = medications.filter((medication) => {
    const normalizedName = normalizeForMatch(medication.name);
    if (!normalizedName) return false;
    if (normalizedQuestion.includes(` ${normalizedName} `)) return true;

    return normalizedName
      .split(" ")
      .filter((token) => token.length >= 4)
      .some((token) => normalizedQuestion.includes(` ${token} `));
  });

  return (matched.length > 0 ? matched : medications)
    .slice(0, limit)
    .map((medication) => medication.id);
}
