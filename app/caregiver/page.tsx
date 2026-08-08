import { Clock3, ShieldCheck } from "lucide-react";
import { PatientCard } from "@/components/caregiver/PatientCard";
import { CaregiverConnectCard } from "@/components/linking/CaregiverConnectCard";
import { CaregiverDoseRealtime } from "@/components/realtime/CaregiverDoseRealtime";
import { Card } from "@/components/ui/Card";
import { DataErrorState } from "@/components/ui/DataState";
import { requireRole } from "@/lib/auth";
import { getCaregiverPatients } from "@/lib/data/phase4";

export default async function CaregiverPage() {
  const [profile, result] = await Promise.all([
    requireRole("caregiver"),
    getCaregiverPatients(),
  ]);

  if (result.error) {
    return <DataErrorState message="Linked patient information is temporarily unavailable. Confirm that the Phase 4 migration has been applied." />;
  }

  const acceptedPatients = result.data.filter((patient) => patient.status === "accepted");
  const pendingCount = result.data.filter((patient) => patient.status === "pending").length;
  const realtimePatients = acceptedPatients.flatMap((patient) => (
    patient.patient_id && patient.full_name
      ? [{
          patientId: patient.patient_id,
          fullName: patient.full_name,
          doses: patient.today_doses.map((dose) => ({
            id: dose.id,
            medicationName: dose.medication.name,
          })),
        }]
      : []
  ));

  return (
    <div className="space-y-8">
      <CaregiverDoseRealtime patients={realtimePatients} />
      <header>
        <p className="eyebrow">Caregiver overview</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Good morning, {profile.full_name}</h1>
        <p className="mt-3 text-lg text-muted">View today’s dose status for approved patients. Dose changes update live.</p>
      </header>

      <CaregiverConnectCard links={result.data} />

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">People you care for</p>
            <h2 className="section-title mt-1">Linked patients</h2>
          </div>
          {pendingCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Clock3 />{pendingCount} pending
            </span>
          ) : null}
        </div>

        {acceptedPatients.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <ShieldCheck className="mx-auto h-14 w-14 text-primary" />
            <h3 className="mt-4 text-2xl font-extrabold">No approved patients yet</h3>
            <p className="mx-auto mt-2 max-w-xl leading-relaxed text-muted">
              Enter a patient’s code above. Medication information appears only after that patient approves the request.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5">
            {acceptedPatients.map((patient) => (
              <PatientCard key={patient.link_id} patient={patient} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
