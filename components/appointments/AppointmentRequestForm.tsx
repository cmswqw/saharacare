"use client";

import { useActionState, useCallback, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2, UserRound } from "lucide-react";
import {
  bookAppointmentAction,
  type AppointmentActionState,
} from "@/app/actions/appointments";
import { AvailableSlotPicker } from "@/components/appointments/AvailableSlotPicker";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";

const fieldClass = "min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-base font-semibold focus:border-primary";
const initialState: AppointmentActionState = { status: "idle", message: "" };

export function AppointmentRequestForm({
  doctors,
  mode = "patient",
  patient,
}: {
  doctors: Array<{ id: string; full_name: string }>;
  mode?: "patient" | "caregiver";
  patient?: { id: string; full_name: string };
}) {
  const { language, t } = useApp();
  const [state, action, pending] = useActionState(bookAppointmentAction, initialState);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const selectSlot = useCallback((startsAt: string) => setSelectedSlot(startsAt), []);

  if (state.status === "success") {
    return (
      <div className="py-5 text-center" role="status">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-extrabold">{t("appointmentBooked")}</h3>
        <p className="mt-2 text-muted">
          {mode === "caregiver" ? t("caregiverAppointmentBookedHelp") : t("appointmentRequestedHelp")}
        </p>
        {mode === "patient" && state.appointmentId ? (
          <Button asChild className="mt-5">
            <Link href={`/patient/appointments/${state.appointmentId}`}>{t("openAppointment")}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {mode === "caregiver" && patient ? (
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30">
          <UserRound className="text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-muted">{t("appointmentFor")}</p>
            <p className="font-extrabold">{patient.full_name}</p>
          </div>
          <input type="hidden" name="patientId" value={patient.id} />
        </div>
      ) : null}

      {doctors.length === 0 ? (
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">
          {t("noDoctors")}
        </p>
      ) : null}

      <div>
        <label htmlFor="doctorId" className="mb-2 block font-bold">{t("selectDoctor")}</label>
        <select
          id="doctorId"
          name="doctorId"
          required
          className={fieldClass}
          value={doctorId}
          onChange={(event) => {
            setDoctorId(event.target.value);
            setDate("");
          }}
        >
          <option value="" disabled>{t("selectDoctor")}</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>
          ))}
        </select>
      </div>

      <AvailableSlotPicker
        doctorId={doctorId}
        date={date}
        onDateChange={setDate}
        selectedSlot={selectedSlot}
        onSlotChange={selectSlot}
      />
      <input type="hidden" name="startsAt" value={selectedSlot} />

      <div>
        <label htmlFor="facility" className="mb-2 block font-bold">{t("facilityStep")}</label>
        <input
          id="facility"
          name="facility"
          required
          maxLength={200}
          className={fieldClass}
          placeholder={t("facilityPlaceholder")}
        />
      </div>
      <div>
        <label htmlFor="purpose" className="mb-2 block font-bold">{t("reasonStep")}</label>
        <select id="purpose" name="purpose" required className={fieldClass} defaultValue="Regular checkup">
          <option value="Regular checkup">{t("reasonRegularCheckup")}</option>
          <option value="Medicine review">{t("reasonMedicineReview")}</option>
          <option value="Blood pressure check">{t("reasonBloodPressure")}</option>
          <option value="Diabetes check">{t("reasonDiabetes")}</option>
          <option value="Feeling unwell">{t("reasonUnwell")}</option>
          <option value="Other">{t("reasonOther")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="note" className="mb-2 block font-bold">{t("optionalNote")}</label>
        <textarea
          id="note"
          name="note"
          maxLength={2000}
          className={`${fieldClass} min-h-28 py-3`}
          placeholder={t("appointmentNotePlaceholder")}
        />
      </div>

      {state.status === "error" ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800">
          {language === "ne" ? t("appointmentRequestError") : state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="large"
        className="w-full"
        disabled={pending || doctors.length === 0 || !selectedSlot}
      >
        <CalendarCheck2 aria-hidden="true" />
        {t(pending ? "bookingAppointment" : "confirmAppointment")}
      </Button>
    </form>
  );
}
