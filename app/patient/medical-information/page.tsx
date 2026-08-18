import { MedicalKycWizard } from "@/components/medical-kyc/MedicalKycWizard";
import { DataErrorState } from "@/components/ui/DataState";
import { requireRole } from "@/lib/auth";
import { getOwnMedications } from "@/lib/data/phase4";

export default async function MedicalInformationPage() {
  const [profile, medicationResult] = await Promise.all([
    requireRole("patient"),
    getOwnMedications(),
  ]);

  if (medicationResult.error) {
    return <DataErrorState messageKey="medicalPrefillError" />;
  }

  return <MedicalKycWizard fullName={profile.full_name} medications={medicationResult.data.filter((medication) => medication.active).map((medication) => ({ name: medication.name, dosage: medication.dosage, instructions: medication.instructions }))} />;
}
