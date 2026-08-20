import { DoctorAvailabilityManager } from "@/components/appointments/DoctorAvailabilityManager";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Card } from "@/components/ui/Card";
import { DataErrorState } from "@/components/ui/DataState";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { getAppointments, getDoctorAvailability } from "@/lib/data/appointments";

export default async function DoctorAvailabilityPage() {
  const [availability, appointments] = await Promise.all([
    getDoctorAvailability(),
    getAppointments(),
  ]);
  if (availability.error || appointments.error) return <DataErrorState messageKey="doctorAvailabilityError" />;

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow"><TranslatedText translationKey="doctorCalendar" /></p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight"><TranslatedText translationKey="myCalendar" /></h1>
        <p className="mt-3 text-lg text-muted"><TranslatedText translationKey="doctorCalendarIntro" /></p>
      </header>
      <DoctorAvailabilityManager weekly={availability.weekly} overrides={availability.overrides} />
      <section aria-labelledby="calendar-appointments-heading">
        <p className="eyebrow"><TranslatedText translationKey="bookedTime" /></p>
        <h2 id="calendar-appointments-heading" className="section-title mt-1"><TranslatedText translationKey="calendarAppointments" /></h2>
        <div className="mt-5 grid gap-5">
          {appointments.data.length > 0 ? appointments.data.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} viewer="doctor" />
          )) : (
            <Card className="border-dashed p-8 text-center text-muted"><TranslatedText translationKey="noAssignedAppointments" /></Card>
          )}
        </div>
      </section>
    </div>
  );
}
