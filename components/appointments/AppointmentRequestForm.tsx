"use client";
import { useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { requestAppointment } from "@/lib/fake-api";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { AppointmentSuccess } from "./AppointmentSuccess";

const fieldClass = "min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-base font-semibold focus:border-primary";

export function AppointmentRequestForm() {
  const { addAppointment, t } = useApp(); const [submitted, setSubmitted] = useState(false); const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ doctor: "डा. अनिता श्रेष्ठ", facility: "Sahara Community Clinic", purpose: "Regular checkup", date: "2026-08-20", time: "Morning", note: "" });
  if (submitted) return <AppointmentSuccess onReset={() => setSubmitted(false)} />;
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); const appointment = await requestAppointment({ doctor: form.doctor, facility: form.facility, purpose: form.purpose, date: form.date, time: form.time }); addAppointment(appointment); setLoading(false); setSubmitted(true); }
  return <form onSubmit={handleSubmit} className="space-y-5"><div><label htmlFor="doctor" className="mb-2 block font-bold">1. Choose doctor or hospital</label><select id="doctor" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} className={fieldClass}><option>डा. अनिता श्रेष्ठ</option><option>Dr. Raj Bhandari</option><option>Sahara Community Hospital</option></select></div><div><label htmlFor="reason" className="mb-2 block font-bold">2. Choose reason</label><select id="reason" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={fieldClass}><option>Regular checkup</option><option>Medicine review</option><option>Blood pressure check</option><option>Diabetes check</option><option>Feeling unwell</option><option>Other</option></select></div><div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="date" className="mb-2 block font-bold">3. Preferred date</label><input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fieldClass} /></div><div><label htmlFor="time" className="mb-2 block font-bold">4. Preferred time</label><select id="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={fieldClass}><option>Morning</option><option>Afternoon</option></select></div></div><div><label htmlFor="note" className="mb-2 block font-bold">5. Optional note</label><textarea id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${fieldClass} min-h-28 py-3`} placeholder="Anything the clinic should know?" /></div><Button type="submit" size="large" className="w-full" disabled={loading}><CalendarCheck2 />{loading ? "Sending request…" : t("requestCheckup")}</Button></form>;
}
