"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MedicationEmptyState } from "@/components/ui/DataState";
import { MedicineCard } from "@/components/medicine/MedicineCard";
import { MedicationForm } from "@/components/medicine/MedicationForm";
import { useApp } from "@/components/providers/AppProvider";
import type { Medication } from "@/types";

export function MedicationManager({ medications }: { medications: Medication[] }) {
  const { t } = useApp();
  const [editing, setEditing] = useState<Medication | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openForm(medication: Medication | null) {
    setEditing(medication);
    setFormOpen(true);
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">{t("medicationPlan")}</p>
          <h1 className="patient-heading mt-2">{t("myMedicines")}</h1>
          <p className="mt-3 text-lg text-muted">
            {t("medicationPlanHelp")}
          </p>
        </div>
        <Button size="large" onClick={() => openForm(null)}><Plus />{t("addMedication")}</Button>
      </div>

      <div className="mt-8 grid gap-6">
        {medications.length === 0 ? (
          <MedicationEmptyState>
            <Button onClick={() => openForm(null)}><Plus />{t("addFirstMedication")}</Button>
          </MedicationEmptyState>
        ) : medications.map((medication) => (
          <MedicineCard
            key={medication.id}
            medication={medication}
            onEdit={openForm}
          />
        ))}
      </div>

      {formOpen ? (
        <MedicationForm
          key={editing?.id ?? "new-medication"}
          medication={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </>
  );
}
