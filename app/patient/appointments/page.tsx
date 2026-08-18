import { PatientAppointmentsView } from "@/components/appointments/PatientAppointmentsView";
import { DataErrorState } from "@/components/ui/DataState";
import { getAppointments, getDoctors } from "@/lib/data/appointments";

export default async function AppointmentsPage() {
  const [appointments, doctors] = await Promise.all([getAppointments(), getDoctors()]);
  if (appointments.error || doctors.error) return <DataErrorState messageKey="appointmentsError" />;
  return <PatientAppointmentsView appointments={appointments.data} doctors={doctors.data} />;
}
