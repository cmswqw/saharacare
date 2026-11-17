"use client";

import { useState } from "react";
import type { Appointment } from "@/types";
import { useApp } from "@/components/providers/AppProvider";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentRequestForm } from "@/components/appointments/AppointmentRequestForm";
import { Card } from "@/components/ui/Card";
import { BookingGuidance } from "@/components/chat/BookingGuidance";

export function PatientAppointmentsView({ appointments, doctors }: { appointments: Appointment[]; doctors: Array<{ id: string; full_name: string }> }) {
  const { t } = useApp();
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="patient-heading mt-2">{t("appointments")}</h1>
      </header>
      <section id="booking-helper" hidden={showForm} className="scroll-mt-24 min-w-0" aria-label={t("guidanceTitle")}><BookingGuidance patientId={null} disabled={false} /></section>
      <details open={showForm} onToggle={event => setShowForm(event.currentTarget.open)} className="rounded-xl border p-4">
        <summary className="min-h-12 cursor-pointer py-2 text-lg font-bold">{t("bookingOtherDoctor")}</summary>
        <div className="pt-4"><AppointmentRequestForm active={showForm} doctors={doctors} /></div>
      </details>
      <details className="rounded-xl border p-4"><summary className="min-h-12 cursor-pointer py-2 text-lg font-bold">{t("contacts")}</summary><ContactsSection compact /></details>
      <section>
        <div className="mb-5"><p className="eyebrow">{t("yourVisits")}</p><h2 className="section-title mt-1">{t("upcomingAppointments")}</h2></div>
        {appointments.length > 0 ? <div className="grid items-start gap-5 xl:grid-cols-2">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div> : <Card className="border-dashed p-8 text-center text-muted">{t("noAppointments")}</Card>}
      </section>
    </div>
  );
}
