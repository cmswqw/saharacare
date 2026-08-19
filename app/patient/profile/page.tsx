import { PatientProfile } from "@/components/patient/PatientProfile";
import { DataErrorState } from "@/components/ui/DataState";
import { getPatientLinkingData } from "@/lib/data/phase4";

export default async function ProfilePage() {
  const result = await getPatientLinkingData();
  if (result.error || !result.data.linkingCode) {
    return <DataErrorState messageKey="linkedPatientsError" />;
  }

  return <PatientProfile linkingCode={result.data.linkingCode} caregiverLinks={result.data.links} />;
}
