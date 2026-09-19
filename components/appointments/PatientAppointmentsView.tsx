"use client";

import { useState } from "react";
import type { Appointment } from "@/types";
import { useApp } from "@/components/providers/AppProvider";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentRequestForm } from "@/components/appointments/AppointmentRequestForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function PatientAppointmentsView({ appointments, doctors }: { appointments: Appointment[]; doctors: Array<{ id: string; full_name: string }> }) {
  const { t } = useApp();
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">{t("careAndVisits")}</p>
        <h1 className="patient-heading mt-2">{t("appointments")}</h1>
        <p className="page-intro mt-3">{t("appointmentsIntro")}</p>
      </header>
      <ContactsSection compact />
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">{t("secureRequest")}</p><h2 className="section-title mt-1">{t("requestCheckup")}</h2></div>
          {!showForm ? <Button size="large" onClick={() => setShowForm(true)}>{t("startRequest")}</Button> : null}
        </div>
        {showForm ? <Card className="p-5 md:p-7"><AppointmentRequestForm doctors={doctors} /></Card> : <Card className="border-blue-200 bg-blue-50/55 p-5 text-base leading-relaxed text-muted md:p-6 md:text-lg dark:bg-blue-950/20">{t("appointmentPrivacy")}</Card>}
      </section>
      <section>
        <div className="mb-5"><p className="eyebrow">{t("yourVisits")}</p><h2 className="section-title mt-1">{t("upcomingAppointments")}</h2></div>
        {appointments.length > 0 ? <div className="grid items-start gap-5 xl:grid-cols-2">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div> : <Card className="border-dashed p-8 text-center text-muted">{t("noAppointments")}</Card>}
      </section>
    </div>
  );
}
