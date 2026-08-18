"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createEmptyMedicalKyc } from "@/lib/medical-kyc/defaults";
import { generateMedicalSummaryPdf } from "@/lib/medical-kyc/pdf";
import type { MedicalKyc } from "@/lib/medical-kyc/types";

type GeneratedSummary = {
  file: File;
  url: string;
  generatedAt: string;
};

type MedicalKycContextValue = {
  draft: MedicalKyc;
  setDraft: React.Dispatch<React.SetStateAction<MedicalKyc>>;
  initializePatient: (fullName: string, medications: Array<{ name: string; dosage: string; instructions: string | null }>) => void;
  generatedSummary: GeneratedSummary | null;
  generating: boolean;
  generateSummary: () => Promise<GeneratedSummary>;
  clearSummary: () => void;
};

const MedicalKycContext = createContext<MedicalKycContextValue | null>(null);

export function MedicalKycProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<MedicalKyc>(() => createEmptyMedicalKyc());
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const clearSummary = useCallback(() => {
    setGeneratedSummary((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => () => {
    if (generatedSummary) URL.revokeObjectURL(generatedSummary.url);
  }, [generatedSummary]);

  const initializePatient = useCallback((
    fullName: string,
    medications: Array<{ name: string; dosage: string; instructions: string | null }>,
  ) => {
    if (initialized) return;
    setDraft((current) => ({
      ...current,
      patientBasics: { ...current.patientBasics, fullName },
      currentMedications: medications.length === 0 ? current.currentMedications : {
        answer: "yes",
        entries: medications.map((medication) => ({
          id: crypto.randomUUID(),
          name: medication.name,
          dosage: medication.dosage,
          frequency: "",
          reason: "",
          note: medication.instructions ?? "",
        })),
      },
    }));
    setInitialized(true);
  }, [initialized]);

  const generateSummary = useCallback(async () => {
    setGenerating(true);
    try {
      const file = await generateMedicalSummaryPdf(draft);
      const result = {
        file,
        url: URL.createObjectURL(file),
        generatedAt: new Date(file.lastModified).toISOString(),
      };
      setGeneratedSummary((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return result;
      });
      return result;
    } finally {
      setGenerating(false);
    }
  }, [draft]);

  const value = useMemo<MedicalKycContextValue>(() => ({
    draft,
    setDraft,
    initializePatient,
    generatedSummary,
    generating,
    generateSummary,
    clearSummary,
  }), [clearSummary, draft, generateSummary, generatedSummary, generating, initializePatient]);

  return <MedicalKycContext.Provider value={value}>{children}</MedicalKycContext.Provider>;
}

export function useMedicalKyc() {
  const context = useContext(MedicalKycContext);
  if (!context) throw new Error("useMedicalKyc must be used inside MedicalKycProvider");
  return context;
}
