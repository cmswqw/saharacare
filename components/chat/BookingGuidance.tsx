"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { symptomChips, type BookingGuidanceResponse, type SymptomChip } from "@/lib/chat/booking-contracts";
import { parseDirectoryMatches, parseDirectorySpecialties } from "@/lib/directory/contracts";
import type { TranslationKey } from "@/lib/i18n";
import { AppointmentRequestForm } from "@/components/appointments/AppointmentRequestForm";

const chipLabels: Record<SymptomChip, TranslationKey> = {
  leg_knee: "guidanceChipLeg", chest: "guidanceChipChest", fever_cold_fatigue: "guidanceChipFever",
  skin: "guidanceChipSkin", child: "guidanceChipChild", other: "guidanceChipOther",
};
const clarificationLabels: Record<string, TranslationKey> = {
  duration: "guidanceAskDuration", severity: "guidanceAskSeverity", child_age: "guidanceAskChildAge", associated_symptoms: "guidanceAskAssociated",
};
const statusLabels: Record<BookingGuidanceResponse["status"], TranslationKey> = {
  ready: "guidanceIntro", emergency: "guidanceEmergency", urgent: "guidanceUrgent", clarification: "guidanceUncertain",
  matches: "guidanceMatches", no_matches: "guidanceNoMatches", directory_error: "guidanceDirectoryError",
  ai_unavailable: "guidanceAiError", review_required: "guidanceReviewRequired", catalog_empty: "guidanceCatalogEmpty",
  invalid_request: "guidanceInvalid", denied: "guidanceDenied", rate_limited: "guidanceRateLimit",
};
const empty: BookingGuidanceResponse = { status: "ready", guidance: null, source: "fallback", specialties: [], providers: [] };

function parseResponse(raw: unknown): BookingGuidanceResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as BookingGuidanceResponse;
  const specialties = parseDirectorySpecialties(value.specialties);
  const providers = parseDirectoryMatches(value.providers);
  if (!Object.hasOwn(statusLabels, value.status) || !specialties || !providers) return null;
  if (value.guidance && (!["emergency", "urgent", "uncertain", "routine"].includes(value.guidance.urgency)
    || !Array.isArray(value.guidance.specialtyIds) || value.guidance.specialtyIds.some(id => !specialties.some(s => s.id === id))
    || (value.guidance.clarification !== null && !Object.hasOwn(clarificationLabels, value.guidance.clarification)))) return null;
  return { ...value, providers, specialties };
}

export function BookingGuidance({ patientId, patientName, disabled }: { patientId: string | null; patientName?: string; disabled: boolean }) {
  const { t, language } = useApp();
  const [symptoms, setSymptoms] = useState("");
  const [chip, setChip] = useState<SymptomChip | null>(null);
  const [result, setResult] = useState<BookingGuidanceResponse>(empty);
  const [pending, setPending] = useState(false);
  const [manualSpecialty, setManualSpecialty] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [step, setStep] = useState<"care" | "doctors" | "booking">("care");
  const [help, setHelp] = useState(false);
  const [answer, setAnswer] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const lastActionRef = useRef<"guide" | "browse">("guide");
  const lastBrowseRef = useRef("");

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController(); controllerRef.current = controller;
    setCatalogLoading(true);
    void fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "booking_guidance", action: "specialties", patientId }), signal: controller.signal,
    }).then(response => response.json()).then(raw => {
      if (!controller.signal.aborted) setResult(parseResponse(raw) ?? { ...empty, status: "ai_unavailable" });
    }).catch(() => { if (!controller.signal.aborted) setResult({ ...empty, status: "ai_unavailable" }); }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controllerRef.current?.abort();
  }, [patientId, disabled, catalogAttempt]);

  const urgent = result.status === "urgent" || result.status === "emergency" ? result.status : null;
  const selectedProvider = result.providers.find(provider => `${provider.affiliation_id}:${provider.specialty_id}` === selectedBooking);
  useEffect(() => { if (step !== "booking") headingRef.current?.focus(); }, [step]);

  async function send(action: "guide" | "browse", event?: FormEvent) {
    event?.preventDefault();
    if (pending || disabled) return;
    // Going back and continuing the unchanged selection must not destroy the
    // doctor's mounted time/review draft. Quotes are still rechecked by booking.
    if (action === "browse" && lastActionRef.current === "browse" && result.status === "matches" && lastBrowseRef.current === manualSpecialty) { setStep("doctors"); return; }
    lastActionRef.current = action;
    if (action === "browse") lastBrowseRef.current = manualSpecialty;
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setPending(true);
    setCatalogLoading(false);
    setSelectedBooking(null);
    const description = action === "guide" && answer.trim() ? `${symptoms}\n${answer.trim()}` : symptoms;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ mode: "booking_guidance", action, symptoms: description, chip, patientId, specialtyId: action === "browse" ? manualSpecialty : null }),
      });
      const parsed = parseResponse(await response.json());
      if (!controller.signal.aborted) {
        setResult(parsed ?? { ...empty, status: "ai_unavailable" });
        if (action === "guide" && parsed) { setSymptoms(description); setAnswer(""); }
        if (action === "browse" && parsed && ["matches", "no_matches"].includes(parsed.status)) setStep("doctors");
      }
    } catch {
      if (!controller.signal.aborted) setResult(current => ({ ...current, status: "ai_unavailable", guidance: null, providers: [] }));
    } finally { if (!controller.signal.aborted) setPending(false); }
  }

  const failure = ["directory_error", "ai_unavailable", "rate_limited", "invalid_request", "denied", "catalog_empty", "review_required"].includes(result.status);
  const clarification = help && result.status === "clarification" ? result.guidance?.clarification : null;
  return <Card className="min-w-0 space-y-5 p-4 text-lg leading-relaxed sm:p-6 [overflow-wrap:anywhere]">
    {step !== "booking" ? <header className="space-y-1">
      <p className="font-bold text-primary" aria-live="polite">{t("bookingStepCount", { step: step === "care" ? 1 : 2 })}</p>
      <h2 ref={headingRef} tabIndex={-1} className="section-title focus:outline-none">{t(step === "care" ? "bookingChooseCare" : "bookingChooseDoctor")}</h2>
    </header> : null}
    {urgent ? <div role="alert" className="rounded-xl border-2 border-danger p-4 font-bold">{t(urgent === "emergency" ? "guidanceEmergency" : "guidanceUrgent")}</div> : <>
      {catalogLoading || pending ? <p role="status">{t("thinking")}</p> : null}
      {failure && !pending ? <div role="alert" className="space-y-3 rounded-xl border-2 border-warning p-3">
        <p>{t(statusLabels[result.status])}</p>
        {["directory_error", "ai_unavailable", "rate_limited", "invalid_request"].includes(result.status) ? <Button type="button" variant="secondary" disabled={disabled || catalogLoading} onClick={() => { if (result.specialties.length && (symptoms.trim() || lastActionRef.current === "browse")) void send(lastActionRef.current); else setCatalogAttempt(value => value + 1); }}>{t("bookingRetry")}</Button> : null}
      </div> : null}
      {step === "care" ? <>
        {help ? <>
          <p className="rounded-xl border border-warning/40 p-3">{t("bookingBriefSafety")}</p>
          <form onSubmit={event => void send("guide", event)} className="space-y-4">
            {!clarification && result.status !== "matches" ? <div className="grid grid-cols-2 gap-2" aria-label={t("guidanceSymptoms")}>
              {symptomChips.map(option => <button key={option} type="button" aria-pressed={chip === option} disabled={pending || disabled}
                className={`min-h-14 rounded-xl border-2 px-3 py-2 text-base font-bold focus-visible:ring-4 focus-visible:ring-primary/30 ${chip === option ? "border-primary bg-primary/10" : "border-border"}`}
                onClick={() => { setChip(option); setSymptoms(t(chipLabels[option])); setResult(current => ({ ...current, status: "ready", guidance: null, providers: [] })); }}>{t(chipLabels[option])}</button>)}
            </div> : null}
            {result.status !== "matches" ? <label className="block space-y-2 font-bold"><span>{t(clarification ? clarificationLabels[clarification] : "bookingSymptomQuestion")}</span>
              <textarea value={clarification ? answer : symptoms} onChange={event => { if (clarification) setAnswer(event.target.value); else { setSymptoms(event.target.value); setResult(current => ({ ...current, status: "ready", guidance: null, providers: [] })); } }} required rows={3} maxLength={clarification ? Math.max(0, 1999 - symptoms.length) : 2000} disabled={pending || disabled} className="w-full rounded-xl border-2 bg-card p-3 text-lg" />
            </label> : null}
            {result.status !== "matches" ? <p>{t("bookingBriefPrivacy")}</p> : null}
            {result.status === "matches" ? <>
              <p>{t("guidancePossibleSpecialties")}: {result.guidance?.specialtyIds.map(specialtyId => { const specialty = result.specialties.find(s => s.id === specialtyId); return specialty ? language === "ne" ? specialty.name_ne : specialty.name_en : ""; }).join(" · ")}</p>
              <Button type="button" className="w-full min-h-14" onClick={() => setStep("doctors")}>{t("bookingShowDoctors")}</Button>
            </> : <Button disabled={pending || disabled || !(clarification ? answer.trim() : symptoms.trim())} className="w-full min-h-14" type="submit">{t(pending ? "thinking" : "guidanceCheck")}</Button>}
            {result.status === "no_matches" ? <p role="status">{t("guidanceNoMatches")}</p> : null}
          </form>
          <Button type="button" variant="secondary" className="w-full min-h-14" disabled={pending} onClick={() => setHelp(false)}>{t("bookingChooseMyself")}</Button>
          <details><summary className="min-h-12 cursor-pointer py-2 font-bold">{t("bookingAboutHelp")}</summary><p>{t("guidancePrivacy")}</p><p>{t("guidanceSafetyNotice")}</p></details>
        </> : <form onSubmit={event => void send("browse", event)} className="space-y-4">
          <label className="block space-y-2 font-bold"><span>{t("guidanceChooseSpecialty")}</span><select value={manualSpecialty} onChange={event => setManualSpecialty(event.target.value)} disabled={pending || disabled || catalogLoading} className="min-h-14 w-full min-w-0 rounded-xl border-2 bg-card px-3 text-lg">
            <option value="">{t("guidanceChooseSpecialty")}</option>
            {result.specialties.map(s => <option key={s.id} value={s.id}>{language === "ne" ? s.name_ne : s.name_en}</option>)}
          </select></label>
          <Button type="submit" className="w-full min-h-14" disabled={pending || disabled || !manualSpecialty}>{t("bookingShowDoctors")}</Button>
          <Button type="button" variant="secondary" className="w-full min-h-14" disabled={pending || disabled} onClick={() => { setHelp(true); setResult(current => ({ ...current, status: "ready", guidance: null, providers: [] })); setSelectedBooking(null); }}>{t("bookingHelpChoose")}</Button>
          <p>{t("bookingBriefSafety")}</p>
          <details><summary className="min-h-12 cursor-pointer py-2 font-bold">{t("bookingAboutDirectory")}</summary><p>{t("guidanceBrowseNotice")}</p><p>{t("guidanceSafetyNotice")}</p></details>
        </form>}
      </> : null}
      {step === "doctors" ? <>
        {result.status === "no_matches" ? <p role="status">{t("guidanceNoMatches")}</p> : null}
        <fieldset className="min-w-0 space-y-3"><legend className="sr-only">{t("bookingChooseDoctor")}</legend>
          {result.providers.filter(provider => provider.provider_type === "doctor").map((provider, index) => {
            const key = `${provider.affiliation_id}:${provider.specialty_id}`;
            const bookable = provider.provider_type === "doctor" && provider.doctor_profile_id && provider.affiliation_id;
            return <div key={`${provider.provider_id}:${key}`} className={`min-w-0 rounded-xl border-2 p-4 ${selectedBooking === key ? "border-primary" : "border-border"}`}>
              <label className="flex min-h-14 items-start gap-3" htmlFor={bookable ? `${id}-doctor-${index}` : undefined}>
                {bookable ? <input id={`${id}-doctor-${index}`} type="radio" name={`${id}-doctor`} checked={selectedBooking === key} onChange={() => setSelectedBooking(key)} className="mt-1 h-6 w-6 shrink-0 accent-primary" /> : null}
                <span className="min-w-0 space-y-1"><span className="block font-bold">{provider.display_name}</span>
                  <span className="block">{language === "ne" ? provider.specialty_name_ne : provider.specialty_name_en}</span>
                  {provider.facility_name ? <span className="block">{provider.facility_name}</span> : null}
                  <span className="block">{t("guidanceFee")}: {provider.fee_amount === null ? t("guidanceFeeUnknown") : `${provider.currency} ${provider.fee_amount}`}</span>
                </span>
              </label>
              {provider.is_sponsored ? <p className="mt-2 font-bold">{language === "ne" ? provider.sponsorship_label_ne : provider.sponsorship_label_en}</p> : null}
              <details><summary className="min-h-12 cursor-pointer py-2 font-bold">{t("bookingViewDetails")}</summary>
                <p>{provider.public_address ?? provider.facility_address}</p>
                {provider.public_phone ?? provider.facility_phone ? <a className="flex min-h-12 items-center underline" href={`tel:${(provider.public_phone ?? provider.facility_phone ?? "").replace(/[^+0-9]/g, "")}`}>{t("bookingCallContact")}: {provider.public_phone ?? provider.facility_phone}</a> : null}
                {provider.public_email ? <a className="flex min-h-12 items-center underline" href={`mailto:${encodeURIComponent(provider.public_email)}`}>{provider.public_email}</a> : null}
                {!provider.public_phone && !provider.facility_phone && !provider.public_email ? <p>{t("bookingContactUnavailable")}</p> : null}
                {!bookable ? <p>{t("bookingContactOnly")}</p> : null}
              </details>
            </div>;
          })}
        </fieldset>
        {result.providers.some(provider => provider.provider_type !== "doctor") ? <details><summary className="min-h-12 cursor-pointer py-2 font-bold">{t("bookingFacilityContacts")}</summary>
          {result.providers.filter(provider => provider.provider_type !== "doctor").map(provider => <div key={`${provider.provider_id}:${provider.specialty_id}`} className="space-y-2 rounded-xl border p-3">
            <p className="font-bold">{provider.display_name}</p><p>{provider.public_address}</p>
            {provider.is_sponsored ? <p className="font-bold">{language === "ne" ? provider.sponsorship_label_ne : provider.sponsorship_label_en}</p> : null}
            <p>{t("bookingContactOnly")}</p><p>{t("guidanceFee")}: {provider.fee_amount === null ? t("guidanceFeeUnknown") : `${provider.currency} ${provider.fee_amount}`}</p>
            {provider.public_phone ? <a className="flex min-h-12 items-center underline" href={`tel:${provider.public_phone.replace(/[^+0-9]/g, "")}`}>{t("bookingCallContact")}: {provider.public_phone}</a> : null}
            {provider.public_email ? <a className="flex min-h-12 items-center underline" href={`mailto:${encodeURIComponent(provider.public_email)}`}>{provider.public_email}</a> : null}
            {!provider.public_phone && !provider.public_email ? <p>{t("bookingContactUnavailable")}</p> : null}
          </div>)}
        </details> : null}
        {result.providers.some(provider => provider.provider_type === "doctor" && provider.affiliation_id) ? <Button type="button" className="w-full min-h-14" disabled={!selectedProvider || disabled} onClick={() => setStep("booking")}>{t("bookingChooseTime")}</Button> : null}
        <Button type="button" variant="secondary" className="w-full min-h-14" onClick={() => setStep("care")}>{t("back")}</Button>
      </> : null}
      {selectedProvider?.doctor_profile_id ? <div hidden={step !== "booking"}>
        <AppointmentRequestForm key={`${selectedProvider.affiliation_id}:${selectedProvider.specialty_id}`} directoryMatch={selectedProvider}
          doctors={[{ id: selectedProvider.doctor_profile_id, full_name: selectedProvider.display_name }]} active={step === "booking"} onBackToDoctor={() => setStep("doctors")}
          mode={patientId ? "caregiver" : "patient"} patient={patientId ? { id: patientId, full_name: patientName ?? t("approvedPatient") } : undefined} />
      </div> : null}
    </>}
  </Card>;
}
