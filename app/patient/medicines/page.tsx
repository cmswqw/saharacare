import { MedicationManager } from "@/components/medicine/MedicationManager";
import { DataErrorState } from "@/components/ui/DataState";
import { getOwnMedications } from "@/lib/data/phase4";

export default async function MedicinesPage() {
  const result = await getOwnMedications();

  if (result.error) {
    return <DataErrorState messageKey="medicationPlanError" />;
  }

  return <MedicationManager medications={result.data} />;
}
