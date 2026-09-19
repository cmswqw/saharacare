import { CalendarDays } from "lucide-react";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Card } from "@/components/ui/Card";
import { DataErrorState } from "@/components/ui/DataState";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { requireRole } from "@/lib/auth";
import { getAppointments } from "@/lib/data/appointments";

export default async function DoctorPage() {
  const [profile, appointments] = await Promise.all([requireRole("doctor"), getAppointments()]);
  if (appointments.error) return <DataErrorState messageKey="assignedAppointmentsError" />;
  return <div className="space-y-6 md:space-y-8"><Card className="relative overflow-hidden bg-gradient-to-br from-white via-white to-blue-50 p-5 md:p-8 dark:from-card dark:via-card dark:to-blue-950/40"><span className="absolute -end-10 -top-10 h-32 w-32 rounded-full bg-blue-100/60" aria-hidden="true" /><header className="relative flex items-start gap-4"><span className="icon-tile hidden sm:grid"><CalendarDays aria-hidden="true" /></span><div><p className="eyebrow"><TranslatedText translationKey="doctorAppointments" /></p><h1 className="patient-heading mt-2"><TranslatedText translationKey="welcomeDoctor" values={{ name: profile.full_name }} /></h1><p className="page-intro mt-2"><TranslatedText translationKey="doctorDashboardIntro" /></p></div></header></Card>{appointments.data.length > 0 ? <div className="grid items-start gap-5 xl:grid-cols-2">{appointments.data.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} viewer="doctor" />)}</div> : <Card className="border-dashed p-8 text-center md:p-10"><span className="icon-tile mx-auto"><CalendarDays aria-hidden="true" /></span><h2 className="mt-4 text-2xl font-extrabold"><TranslatedText translationKey="noAssignedAppointments" /></h2><p className="mt-2 text-muted"><TranslatedText translationKey="noAssignedAppointmentsHelp" /></p></Card>}</div>;
}
