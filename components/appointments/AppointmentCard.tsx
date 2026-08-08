"use client";
import { CalendarDays, Clock3, MapPin, Phone, Stethoscope, X } from "lucide-react";
import type { Appointment } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useApp } from "@/components/providers/AppProvider";

export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const { toast } = useApp(); const complete = appointment.status === "Confirmed";
  return <Card className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/50"><Stethoscope /></span><div><h3 className="text-xl font-extrabold">{appointment.doctor}</h3><p className="mt-1 text-base text-muted">{appointment.facility}</p></div></div><StatusPill status={complete ? "confirmed" : "requested"} label={appointment.status} /></div><div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800 sm:grid-cols-2"><p className="flex items-center gap-2 font-bold"><CalendarDays className="text-primary" />{appointment.date}</p><p className="flex items-center gap-2 font-bold"><Clock3 className="text-primary" />{appointment.time}</p><p className="sm:col-span-2 text-muted">{appointment.purpose}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Button variant="secondary" onClick={() => toast("Demo clinic contact opened.")}><Phone />Call clinic</Button><Button variant="secondary" onClick={() => toast("Directions placeholder opened.")}><MapPin />Directions</Button><Button variant="ghost" onClick={() => toast("Demo request cancelled.", "warning")}><X />Cancel request</Button></div></Card>;
}
