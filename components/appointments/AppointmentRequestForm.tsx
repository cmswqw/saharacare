"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2, UserRound } from "lucide-react";
import {
  bookAppointmentAction,
  getAvailableAppointmentSlotsAction,
  getDirectoryBookingSlotsAction,
  type AppointmentActionState,
} from "@/app/actions/appointments";
import { AvailableSlotPicker } from "@/components/appointments/AvailableSlotPicker";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { APPOINTMENT_TIME_ZONE, APPOINTMENT_SLOT_MINUTES, formatAppointmentDate, formatAppointmentTime, getAppointmentPurposeKey } from "@/lib/appointment-utils";
import type { DirectoryMatch } from "@/lib/directory/contracts";
import type { BookingReview, DirectoryBookingQuote } from "@/lib/directory/booking";

const fieldClass = "min-h-14 w-full rounded-2xl border-2 border-border bg-card px-4 text-lg font-semibold transition-colors focus:border-primary";
const initialState: AppointmentActionState = { status: "idle", message: "" };

export function AppointmentRequestForm({
  doctors,
  mode = "patient",
  patient,
  directoryMatch,
  active = true,
  onBackToDoctor,
}: {
  doctors: Array<{ id: string; full_name: string }>;
  mode?: "patient" | "caregiver";
  patient?: { id: string; full_name: string };
  directoryMatch?: DirectoryMatch;
  active?: boolean;
  onBackToDoctor?: () => void;
}) {
  const { language, t } = useApp();
  const formId = useId();
  const [state, action, pending] = useActionState(bookAppointmentAction, initialState);
  const [doctorId, setDoctorId] = useState(directoryMatch?.doctor_profile_id ?? "");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const selectSlot = useCallback((startsAt: string) => setSelectedSlot(startsAt), []);
  const [quote, setQuote] = useState<DirectoryBookingQuote | null>(null);
  const [facility, setFacility] = useState("");
  const [purpose, setPurpose] = useState("Regular checkup");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState<{ snapshot: string; requestId: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState<"doctor" | "time" | "review">(directoryMatch ? "time" : "doctor");
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (active) headingRef.current?.focus(); }, [step, active]);
  useEffect(() => {
    if (state.status === "error") { setStep("time"); setConfirmed(false); }
  }, [state]);
  const quoteRequest = useRef(0);
  const providerId = directoryMatch?.provider_id;
  const affiliationId = directoryMatch?.affiliation_id;
  const specialtyId = directoryMatch?.specialty_id;
  const patientId = patient?.id ?? "";
  const loadSlots = useCallback(async (selectedDoctor: string, selectedDate: string) => {
    if (!providerId || !affiliationId || !specialtyId) return getAvailableAppointmentSlotsAction(selectedDoctor, selectedDate);
    const version = ++quoteRequest.current;
    const response = await getDirectoryBookingSlotsAction({ providerId, affiliationId, specialtyId }, selectedDate, patientId);
    if (version === quoteRequest.current) setQuote(response.quote);
    return response;
  }, [providerId, affiliationId, specialtyId, patientId]);
  const currentFacility = directoryMatch ? quote?.facilityName ?? "" : facility.trim();
  const currentProvider = directoryMatch ? quote?.providerName ?? "" : doctors.find(doctor => doctor.id === doctorId)?.full_name ?? "";
  const snapshot = JSON.stringify({ doctorId, date, selectedSlot, facility: currentFacility, purpose, note, quote });
  const reviewReady = reviewed?.snapshot === snapshot;
  const showingReview = step === "review" && reviewReady;
  const bookingReview: BookingReview | null = reviewReady && confirmed && reviewed ? {
    requestId: reviewed.requestId, confirmed: true, providerId: quote?.providerId ?? null,
    affiliationId: quote?.affiliationId ?? null, specialtyId: quote?.specialtyId ?? null, facilityId: quote?.facilityId ?? null,
    providerName: currentProvider, facilityName: currentFacility, feeAmount: quote?.feeAmount ?? null,
    currency: quote?.currency ?? null, timeZone: quote?.timeZone ?? APPOINTMENT_TIME_ZONE,
  } : null;

  if (state.status === "success") {
    return (
      <div className="py-5 text-center" role="status">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-extrabold">{t(state.appointmentStatus === "requested" ? "bookingRequestedTitle" : state.appointmentStatus === "confirmed" ? "bookingConfirmedTitle" : "bookingSaved")}</h3>
        {state.appointmentStatus === "cancelled" || state.appointmentStatus === "completed" ? <p className="mt-2 font-bold">{t(state.appointmentStatus === "cancelled" ? "statusCancelled" : "statusCompleted")}</p> : null}
        <p className="mt-2 text-muted">
          {state.appointmentStatus && state.appointmentStatus !== "requested" ? t("bookingSavedStatusHelp") : mode === "caregiver" ? t("caregiverAppointmentBookedHelp") : t("appointmentRequestedHelp")}
        </p>
        {mode === "patient" && state.appointmentId ? (
          <Button asChild className="mt-5">
            <Link href={`/patient/appointments/${state.appointmentId}`}>{t("openAppointment")}</Link>
          </Button>
        ) : null}
        {mode === "caregiver" && state.appointmentId && patient ? <Button asChild className="mt-5"><Link href={`/caregiver/patient/${patient.id}`}>{t("openAppointment")}</Link></Button> : null}
      </div>
    );
  }

  return (
    <form action={action} onSubmit={event => { if (!showingReview || !confirmed) event.preventDefault(); }} className="min-w-0 space-y-5 text-lg [overflow-wrap:anywhere]">
      <header className="space-y-1">
        <p className="font-bold text-primary" aria-live="polite">{t("bookingStepCount", { step: step === "doctor" ? 2 : showingReview ? 4 : 3 })}</p>
        <h2 ref={headingRef} tabIndex={-1} className="section-title focus:outline-none">{t(step === "doctor" ? "bookingChooseDoctor" : showingReview ? "bookingReviewBook" : "bookingChooseTime")}</h2>
      </header>
      <input type="hidden" name="bookingReview" value={bookingReview ? JSON.stringify(bookingReview) : ""} />
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

      {directoryMatch ? <input type="hidden" name="doctorId" value={doctorId} /> : <div hidden={step !== "doctor"}>
        <label htmlFor={`${formId}-doctor`} className="mb-2 block font-bold">{t("selectDoctor")}</label>
        <select
          id={`${formId}-doctor`}
          name="doctorId"
          required
          className={fieldClass}
          value={doctorId}
          onChange={(event) => {
            setDoctorId(event.target.value);
            setDate("");
            setSelectedSlot("");
          }}
        >
          <option value="" disabled>{t("selectDoctor")}</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>
          ))}
        </select>
      </div>}

      <div hidden={step === "doctor" || showingReview} className="space-y-4">
      <p className="font-bold">{directoryMatch?.display_name ?? currentProvider}</p>
      <p>{t("bookingLocalTime", { zone: quote?.timeZone ?? APPOINTMENT_TIME_ZONE })}</p>
      <AvailableSlotPicker
        doctorId={doctorId}
        date={date}
        onDateChange={value => { setDate(value); setSelectedSlot(""); setQuote(null); quoteRequest.current++; }}
        selectedSlot={selectedSlot}
        onSlotChange={selectSlot}
        loadSlots={loadSlots}
        refreshKey={state.status === "error" ? state.nonce : undefined}
        idPrefix={directoryMatch ? `directory-${directoryMatch.affiliation_id}-${directoryMatch.specialty_id}` : "appointment"}
      />
      </div>
      <input type="hidden" name="startsAt" value={selectedSlot} />

      {directoryMatch ? <input type="hidden" name="facility" value={currentFacility} /> : <div hidden={step !== "doctor"}>
        <label htmlFor={`${formId}-facility`} className="mb-2 block font-bold">{t("facilityStep")}</label>
        <input
          id={`${formId}-facility`}
          name="facility"
          required
          maxLength={200}
          className={fieldClass}
          placeholder={t("facilityPlaceholder")}
          value={facility}
          onChange={event => setFacility(event.target.value)}
        />
      </div>}
      <details hidden={!showingReview}>
        <summary className="min-h-12 cursor-pointer py-2 font-bold">{t("bookingEditVisit")}</summary>
        <label htmlFor={`${formId}-purpose`} className="mb-2 block font-bold">{t("bookingVisitReason")}</label>
        <select id={`${formId}-purpose`} name="purpose" required className={fieldClass} value={purpose} onChange={event => { setPurpose(event.target.value); setConfirmed(false); setReviewed(current => current ? { requestId: crypto.randomUUID(), snapshot: JSON.stringify({ doctorId, date, selectedSlot, facility: currentFacility, purpose: event.target.value, note, quote }) } : null); }}>
          <option value="Regular checkup">{t("reasonRegularCheckup")}</option>
          <option value="Medicine review">{t("reasonMedicineReview")}</option>
          <option value="Blood pressure check">{t("reasonBloodPressure")}</option>
          <option value="Diabetes check">{t("reasonDiabetes")}</option>
          <option value="Feeling unwell">{t("reasonUnwell")}</option>
          <option value="Other">{t("reasonOther")}</option>
        </select>
        <label htmlFor={`${formId}-note`} className="mb-2 block font-bold">{t("optionalNote")}</label>
        <textarea
          id={`${formId}-note`}
          name="note"
          maxLength={2000}
          className={`${fieldClass} min-h-28 py-3`}
          placeholder={t("appointmentNotePlaceholder")}
          value={note}
          onChange={event => { setNote(event.target.value); setConfirmed(false); setReviewed(current => current ? { requestId: crypto.randomUUID(), snapshot: JSON.stringify({ doctorId, date, selectedSlot, facility: currentFacility, purpose, note: event.target.value, quote }) } : null); }}
        />
      </details>

      {showingReview ? <section className="space-y-3 rounded-xl border-2 border-primary p-4" aria-label={t("bookingReviewTitle")}>
        <dl className="space-y-2 [overflow-wrap:anywhere]">
          <div><dt className="text-base text-muted">{t("selectDoctor")}</dt><dd className="font-bold">{currentProvider}</dd></div>
          <div><dt className="text-base text-muted">{t("bookingHospital")}</dt><dd>{currentFacility}</dd></div>
          <div><dt className="text-sm text-muted">{t("selectDate")}</dt><dd>{formatAppointmentDate(selectedSlot, language)} · {formatAppointmentTime(selectedSlot, language)} · {quote?.timeZone ?? APPOINTMENT_TIME_ZONE}</dd></div>
          <div><dt className="text-sm text-muted">{t("guidanceFee")}</dt><dd>{quote?.feeAmount == null ? `${t("guidanceFeeUnknown")}${quote?.currency ? ` (${quote.currency})` : ""}` : `${quote.currency} ${quote.feeAmount}`}</dd></div>
          <div><dt className="text-base text-muted">{t("bookingVisitReason")}</dt><dd>{t(getAppointmentPurposeKey(purpose) ?? "reasonOther")}</dd></div>
          {note ? <div><dt className="text-sm text-muted">{t("optionalNote")}</dt><dd>{note}</dd></div> : null}
        </dl>
        {directoryMatch?.is_sponsored ? <p className="font-bold">{language === "ne" ? directoryMatch.sponsorship_label_ne : directoryMatch.sponsorship_label_en}</p> : null}
        <p>{t("bookingRequestNotice")}</p>
        <details><summary className="min-h-12 cursor-pointer py-2 font-bold">{t("bookingMoreInfo")}</summary><p>{t("bookingPaymentNotice")}</p><p>{t("bookingMinutes", { count: APPOINTMENT_SLOT_MINUTES })}</p></details>
        <label className="flex min-h-14 items-start gap-3 py-2 font-bold"><input required type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-primary" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t("bookingShortConsent")}</label>
      </section> : null}
      <div className="space-y-3 border-t pt-4">
        {state.status === "error" ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800">
            {state.errorCode === "stale" ? t("bookingStale") : state.errorCode === "conflict" ? t("bookingConflict") : language === "ne" ? t("appointmentRequestError") : state.message}
          </p>
        ) : null}
        {step === "doctor" ? <Button type="button" className="w-full min-h-14" disabled={!doctorId || !facility.trim() || pending} onClick={() => setStep("time")}>{t("bookingChooseTime")}</Button> : !showingReview ? <Button type="button" className="w-full min-h-14" disabled={pending || !selectedSlot || (Boolean(directoryMatch) && !quote)} onClick={event => {
          if (!event.currentTarget.form?.reportValidity() || !selectedSlot) return;
          setReviewed({ snapshot, requestId: reviewed?.snapshot === snapshot ? reviewed.requestId : crypto.randomUUID() }); setConfirmed(false);
          setStep("review");
        }}>{t("bookingReviewBook")}</Button> : <Button
          type="submit"
          size="large"
          className="w-full"
          disabled={pending || doctors.length === 0 || !selectedSlot || !confirmed}
        >
          <CalendarCheck2 aria-hidden="true" />
          {t(pending ? "bookingAppointment" : "bookAppointment")}
        </Button>}
        {step !== "doctor" ? <Button type="button" variant="secondary" className="w-full min-h-14" disabled={pending} onClick={() => { setConfirmed(false); if (showingReview) setStep("time"); else if (directoryMatch) onBackToDoctor?.(); else setStep("doctor"); }}>{t("back")}</Button> : null}
      </div>
    </form>
  );
}
