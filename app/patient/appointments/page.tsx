"use client";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentRequestForm } from "@/components/appointments/AppointmentRequestForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AppointmentsPage() { const { t, appointments } = useApp(); const [showForm, setShowForm] = useState(false); return <div className="space-y-10"><div><p className="eyebrow">Care & visits</p><h1 className="patient-heading mt-2">{t("appointments")}</h1><p className="mt-3 text-lg text-muted">Contact someone you trust or send a simple checkup request.</p></div><ContactsSection compact /><section><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Simple request</p><h2 className="section-title mt-1">{t("requestCheckup")}</h2></div>{!showForm ? <Button size="large" onClick={() => setShowForm(true)}>Start request</Button> : null}</div>{showForm ? <Card className="p-5 md:p-7"><AppointmentRequestForm /></Card> : <Card className="p-6 text-lg text-muted">Only five short steps. This frontend demo will not contact a real provider.</Card>}</section><section><div className="mb-5"><p className="eyebrow">Your visits</p><h2 className="section-title mt-1">{t("upcomingAppointments")}</h2></div><div className="space-y-5">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div></section></div>; }
