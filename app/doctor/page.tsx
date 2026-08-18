import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Card } from "@/components/ui/Card";
import { DataErrorState } from "@/components/ui/DataState";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { requireRole } from "@/lib/auth";
import { getAppointments } from "@/lib/data/appointments";

export default async function DoctorPage() {
  const [profile, appointments] = await Promise.all([requireRole("doctor"), getAppointments()]);
  if (appointments.error) return <DataErrorState messageKey="assignedAppointmentsError" />;
  return <div className="space-y-8"><header><p className="eyebrow"><TranslatedText translationKey="doctorAppointments" /></p><h1 className="mt-2 text-4xl font-extrabold tracking-tight"><TranslatedText translationKey="welcomeDoctor" values={{ name: profile.full_name }} /></h1><p className="mt-3 text-lg text-muted"><TranslatedText translationKey="doctorDashboardIntro" /></p></header>{appointments.data.length > 0 ? <div className="grid gap-5">{appointments.data.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} viewer="doctor" />)}</div> : <Card className="border-dashed p-10 text-center"><h2 className="text-2xl font-extrabold"><TranslatedText translationKey="noAssignedAppointments" /></h2><p className="mt-2 text-muted"><TranslatedText translationKey="noAssignedAppointmentsHelp" /></p></Card>}</div>;
}
