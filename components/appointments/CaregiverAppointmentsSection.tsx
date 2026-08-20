"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentRequestForm } from "@/components/appointments/AppointmentRequestForm";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Appointment } from "@/types";

export function CaregiverAppointmentsSection({
  patient,
  appointments,
  doctors,
}: {
  patient: { id: string; full_name: string };
  appointments: Appointment[];
  doctors: Array<{ id: string; full_name: string }>;
}) {
  const { t } = useApp();
  const [showBooking, setShowBooking] = useState(false);

  return (
    <section className="space-y-5" aria-labelledby="caregiver-appointments-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("caregiverAppointmentSupport")}</p>
          <h2 id="caregiver-appointments-heading" className="section-title mt-1">
            {t("patientAppointments", { name: patient.full_name })}
          </h2>
        </div>
        <Button
          type="button"
          size="large"
          aria-expanded={showBooking}
          onClick={() => setShowBooking((current) => !current)}
        >
          <CalendarPlus aria-hidden="true" />
          {t(showBooking ? "closeBookingForm" : "bookAppointment")}
        </Button>
      </div>

      {showBooking ? (
        <Card className="p-5 md:p-7">
          <AppointmentRequestForm doctors={doctors} mode="caregiver" patient={patient} />
        </Card>
      ) : null}

      {appointments.length > 0 ? (
        <div className="grid gap-5">
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} viewer="caregiver" />
          ))}
        </div>
      ) : (
        <Card className="border-dashed p-8 text-center text-muted">{t("noPatientAppointments")}</Card>
      )}
    </section>
  );
}
