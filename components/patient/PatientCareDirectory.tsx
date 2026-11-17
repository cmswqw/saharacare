"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, ChevronRight, MapPin, Stethoscope } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { getAppointmentFacilities } from "@/lib/patient-home";
import type { Appointment } from "@/types";

export function PatientCareDirectory({ doctors, appointments, doctorsUnavailable, appointmentsUnavailable }: {
  doctors: { id: string; full_name: string }[];
  appointments: Appointment[];
  doctorsUnavailable: boolean;
  appointmentsUnavailable: boolean;
}) {
  const { t } = useApp();
  const facilities = getAppointmentFacilities(appointments);

  return <div className="grid gap-6 xl:grid-cols-2">
    <section aria-labelledby="home-doctors-title" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="home-doctors-title" className="text-xl font-extrabold tracking-tight">{t("popularDoctors")}</h2><Link href="/patient/appointments" aria-label={t("viewDoctors")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-card text-primary hover:bg-blue-50"><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></Link></div>
      <p className="mb-4 text-xs leading-relaxed text-muted">{t("doctorsDirectoryNote")}</p>
      {doctorsUnavailable || doctors.length === 0 ? <div className="surface p-5 text-sm leading-relaxed text-muted">{t(doctorsUnavailable ? "careDirectoryUnavailable" : "noDoctorsFound")}</div> : (
        <div className="grid auto-rows-fr grid-cols-2 gap-3">
          {doctors.slice(0, 4).map((doctor, index) => <Link key={doctor.id} href="/patient/appointments" className="group surface flex min-h-44 min-w-0 flex-col items-start p-4 transition-colors hover:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/30">
            <div className="mb-4 flex w-full items-start justify-between gap-2"><span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${index % 2 === 0 ? "bg-blue-50 text-primary dark:bg-blue-950" : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"}`}><Stethoscope className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" /></span><ArrowUpRight className="h-4 w-4 text-muted group-hover:text-primary" aria-hidden="true" /></div>
            <h3 className="w-full break-words text-base font-extrabold leading-snug">{doctor.full_name}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{t("doctorOnSaharaCare")}</p>
          </Link>)}
        </div>
      )}
    </section>
    <section aria-labelledby="home-hospitals-title" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="home-hospitals-title" className="text-xl font-extrabold tracking-tight">{t("popularHospitals")}</h2><Link href="/patient/appointments" aria-label={t("exploreAppointments")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-card text-primary hover:bg-blue-50"><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></Link></div>
      <p className="mb-4 text-xs leading-relaxed text-muted">{t("hospitalsDirectoryNote")}</p>
      {appointmentsUnavailable || facilities.length === 0 ? <div className="surface p-5"><Building2 className="mb-3 h-8 w-8 text-primary" aria-hidden="true" /><p className="text-sm leading-relaxed text-muted">{t(appointmentsUnavailable ? "careDirectoryUnavailable" : "noAppointmentFacilities")}</p><Link href="/patient/appointments" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">{t("exploreAppointments")}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></div> : (
        <div className="space-y-3">{facilities.map((facility) => <Link key={facility.name} href={`/patient/appointments/${facility.appointmentId}`} className="surface flex min-h-24 min-w-0 items-center gap-3 p-4 transition-colors hover:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/30"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950"><Building2 className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="break-words text-base font-extrabold leading-snug">{facility.name}</h3><p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t("yourAppointmentFacility")}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /></Link>)}</div>
      )}
    </section>
  </div>;
}
