"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { requestAppointmentAction, type AppointmentActionState } from "@/app/actions/appointments";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

const fieldClass = "min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-base font-semibold focus:border-primary";
const initialState: AppointmentActionState = { status: "idle", message: "" };

export function AppointmentRequestForm({ doctors }: { doctors: Array<{ id: string; full_name: string }> }) {
  const { language, t } = useApp();
  const [state, action, pending] = useActionState(requestAppointmentAction, initialState);
  if (state.status === "success") return <div className="py-5 text-center"><CheckCircle2 className="mx-auto h-16 w-16 text-green-600" /><h3 className="mt-4 text-2xl font-extrabold">{t("appointmentRequested")}</h3><p className="mt-2 text-muted">{t("appointmentRequestedHelp")}</p>{state.appointmentId ? <Button asChild className="mt-5"><Link href={`/patient/appointments/${state.appointmentId}`}>{t("openAppointment")}</Link></Button> : null}</div>;

  return <form action={action} className="space-y-5">
    {doctors.length === 0 ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">{t("noDoctors")}</p> : null}
    <div><label htmlFor="doctorId" className="mb-2 block font-bold">{t("chooseDoctorStep")}</label><select id="doctorId" name="doctorId" required className={fieldClass} defaultValue=""><option value="" disabled>{t("selectDoctor")}</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</select></div>
    <div><label htmlFor="facility" className="mb-2 block font-bold">{t("facilityStep")}</label><input id="facility" name="facility" required maxLength={200} className={fieldClass} placeholder={t("facilityPlaceholder")} /></div>
    <div><label htmlFor="purpose" className="mb-2 block font-bold">{t("reasonStep")}</label><select id="purpose" name="purpose" required className={fieldClass} defaultValue="Regular checkup"><option value="Regular checkup">{t("reasonRegularCheckup")}</option><option value="Medicine review">{t("reasonMedicineReview")}</option><option value="Blood pressure check">{t("reasonBloodPressure")}</option><option value="Diabetes check">{t("reasonDiabetes")}</option><option value="Feeling unwell">{t("reasonUnwell")}</option><option value="Other">{t("reasonOther")}</option></select></div>
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="date" className="mb-2 block font-bold">{t("dateStep")}</label><input id="date" name="date" type="date" required className={fieldClass} /></div><div><label htmlFor="time" className="mb-2 block font-bold">{t("timeStep")}</label><input id="time" name="time" type="time" required className={fieldClass} /></div></div>
    <div><label htmlFor="note" className="mb-2 block font-bold">{t("optionalNote")}</label><textarea id="note" name="note" maxLength={2000} className={`${fieldClass} min-h-28 py-3`} placeholder={t("appointmentNotePlaceholder")} /></div>
    {state.status === "error" ? <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800">{language === "ne" ? t("appointmentRequestError") : state.message}</p> : null}
    <Button type="submit" size="large" className="w-full" disabled={pending || doctors.length === 0}><CalendarCheck2 />{t(pending ? "sendingRequest" : "requestAppointment")}</Button>
  </form>;
}
