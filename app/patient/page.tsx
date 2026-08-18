import { PatientDashboard } from "@/components/patient/PatientDashboard";
import { DataErrorState } from "@/components/ui/DataState";
import { getOwnDoseAnalytics } from "@/lib/data/analytics";
import { getTodayDosesForPatient } from "@/lib/data/doses";
import { getOwnMedications, getPatientLinkingData } from "@/lib/data/phase4";

export default async function PatientHomePage() {
  const [medicationResult, linkingResult, doseResult, analyticsResult] = await Promise.all([
    getOwnMedications(),
    getPatientLinkingData(),
    getTodayDosesForPatient(),
    getOwnDoseAnalytics(),
  ]);

  if (
    medicationResult.error
    || linkingResult.error
    || doseResult.error
    || analyticsResult.error
    || !linkingResult.data.linkingCode
  ) {
    return (
      <DataErrorState messageKey="todayDoseError" />
    );
  }

  return (
    <PatientDashboard
      medications={medicationResult.data}
      linkingCode={linkingResult.data.linkingCode}
      caregiverLinks={linkingResult.data.links}
      todayDoses={doseResult.data}
      weeklyAdherence={analyticsResult.data.weekly}
      recentHistory={analyticsResult.data.history}
    />
  );
}
