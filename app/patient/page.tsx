import { PatientDashboard } from "@/components/patient/PatientDashboard";
import { DataErrorState } from "@/components/ui/DataState";
import { getOwnDoseAnalytics } from "@/lib/data/analytics";
import { getAppointments, getDoctors } from "@/lib/data/appointments";
import { getTodayDosesForPatient } from "@/lib/data/doses";
import { getOwnMedications, getPatientLinkingData } from "@/lib/data/phase4";

export default async function PatientHomePage() {
  const [medicationResult, linkingResult, doseResult, analyticsResult, appointments, doctors] = await Promise.all([
    getOwnMedications(),
    getPatientLinkingData(),
    getTodayDosesForPatient(),
    getOwnDoseAnalytics(),
    getAppointments(),
    getDoctors(),
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
      caregiverLinks={linkingResult.data.links}
      todayDoses={doseResult.data}
      weeklyAdherence={analyticsResult.data.weekly}
      recentHistory={analyticsResult.data.history}
      appointments={appointments.data}
      doctors={doctors.data}
      appointmentsUnavailable={Boolean(appointments.error)}
      doctorsUnavailable={Boolean(doctors.error)}
    />
  );
}
