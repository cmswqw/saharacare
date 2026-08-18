"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMedicalKyc } from "@/components/providers/MedicalKycProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey } from "@/lib/i18n";
import type {
  AllergyEntry,
  FacilityHistoryEntry,
  KycMedicationEntry,
  MedicalHistoryEntry,
  MedicalKyc,
  SurgeryEntry,
  ThreeStateAnswer,
} from "@/lib/medical-kyc/types";

const fieldClass = "min-h-14 w-full rounded-2xl border-2 bg-card px-4 py-3 text-base font-semibold focus:border-primary";
const commonConditions = [
  { value: "Diabetes", key: "kycConditionDiabetes" },
  { value: "High blood pressure", key: "kycConditionBloodPressure" },
  { value: "Heart condition", key: "kycConditionHeart" },
  { value: "Asthma", key: "kycConditionAsthma" },
  { value: "Kidney condition", key: "kycConditionKidney" },
  { value: "Thyroid condition", key: "kycConditionThyroid" },
  { value: "Mental health condition", key: "kycConditionMentalHealth" },
  { value: "Other", key: "kycConditionOther" },
] as const satisfies ReadonlyArray<{ value: string; key: TranslationKey }>;
const familyConditions = [
  { value: "Diabetes", key: "kycConditionDiabetes" },
  { value: "High blood pressure", key: "kycConditionBloodPressure" },
  { value: "Heart disease", key: "kycFamilyHeartDisease" },
  { value: "Stroke", key: "kycFamilyStroke" },
  { value: "Cancer", key: "kycFamilyCancer" },
  { value: "Kidney disease", key: "kycFamilyKidneyDisease" },
  { value: "Mental health condition", key: "kycConditionMentalHealth" },
] as const satisfies ReadonlyArray<{ value: string; key: TranslationKey }>;

const steps = [
  "kycStepBasics",
  "kycStepAllergies",
  "kycStepConditions",
  "kycStepMedications",
  "kycStepHistory",
  "kycStepSurgeries",
  "kycStepHospital",
  "kycStepFamily",
  "kycStepOther",
  "kycStepReview",
] as const satisfies readonly TranslationKey[];

type RepeatableEntry = { id: string } & Record<string, string>;

function AnswerChoice({ value, current, onChange }: { value: ThreeStateAnswer; current: ThreeStateAnswer; onChange: (answer: ThreeStateAnswer) => void }) {
  const { t } = useApp();
  const labelKey = value === "yes" ? "yes" : value === "no" ? "no" : "notSure";
  return <button type="button" aria-pressed={current === value} onClick={() => onChange(value)} className={`min-h-14 rounded-2xl border-2 px-5 font-extrabold ${current === value ? "border-primary bg-blue-50 text-primary dark:bg-blue-950/40" : "bg-card text-muted"}`}>{t(labelKey)}</button>;
}

function AnswerChoices({ current, onChange }: { current: ThreeStateAnswer; onChange: (answer: ThreeStateAnswer) => void }) {
  return <div className="grid gap-3 sm:grid-cols-3">{(["yes", "no", "not_sure"] as const).map((value) => <AnswerChoice key={value} value={value} current={current} onChange={onChange} />)}</div>;
}

function EntryEditor<T extends RepeatableEntry>({ entry, fields, onChange, onRemove }: {
  entry: T;
  fields: Array<{ key: Exclude<keyof T, "id">; labelKey: TranslationKey; placeholderKey?: TranslationKey; type?: string }>;
  onChange: (entry: T) => void;
  onRemove: () => void;
}) {
  const { t } = useApp();
  return <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/40"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={String(field.key)} className="block"><span className="mb-2 block font-bold">{t(field.labelKey)}</span><input type={field.type ?? "text"} value={entry[field.key]} onChange={(event) => onChange({ ...entry, [field.key]: event.target.value })} className={fieldClass} placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined} /></label>)}</div><Button type="button" variant="ghost" className="mt-3 text-red-700" onClick={onRemove}><Trash2 />{t("remove")}</Button></div>;
}

function ReviewSection({ number, titleKey, lines, onEdit }: { number: number; titleKey: TranslationKey; lines: string[]; onEdit: () => void }) {
  const { t } = useApp();
  return <Card className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{t("kycSection", { number })}</p><h3 className="mt-1 text-xl font-extrabold">{t(titleKey)}</h3></div><Button type="button" variant="secondary" onClick={onEdit}>{t("edit")}</Button></div><ul className="mt-4 space-y-1 text-base text-muted">{lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ul></Card>;
}

export function MedicalKycWizard({ fullName, medications }: { fullName: string; medications: Array<{ name: string; dosage: string; instructions: string | null }> }) {
  const { language, t } = useApp();
  const { draft, setDraft, initializePatient, generatedSummary, generating, generateSummary, clearSummary } = useMedicalKyc();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => initializePatient(fullName, medications), [fullName, initializePatient, medications]);

  function updateSection<K extends keyof MedicalKyc>(key: K, update: (section: MedicalKyc[K]) => MedicalKyc[K]) {
    clearSummary();
    setDraft((current) => ({ ...current, [key]: update(current[key]) }));
  }

  function setAnswer<K extends "allergies" | "currentConditions" | "currentMedications" | "medicalHistory" | "surgeries" | "facilityHistory">(key: K, answer: ThreeStateAnswer) {
    updateSection(key, (section) => ({ ...section, answer, entries: answer === "yes" ? section.entries : [] }));
  }

  const progress = ((step + 1) / steps.length) * 100;
  const review = useMemo(() => ({
    basics: [draft.patientBasics.fullName || t("kycNameNotProvided"), draft.patientBasics.dateOfBirth || t("kycDobNotProvided"), draft.patientBasics.bloodGroup || t("kycBloodNotProvided")],
    allergies: [draft.allergies.answer === "yes" ? t("kycAllergyCount", { count: draft.allergies.entries.length }) : t(draft.allergies.answer === "no" ? "no" : "notSure")],
    conditions: [draft.currentConditions.answer === "yes" ? t("kycConditionCount", { count: draft.currentConditions.entries.length }) : t(draft.currentConditions.answer === "no" ? "no" : "notSure")],
    medications: [draft.currentMedications.answer === "yes" ? t("kycMedicationCount", { count: draft.currentMedications.entries.length }) : t(draft.currentMedications.answer === "no" ? "no" : "notSure")],
    history: [draft.medicalHistory.answer === "yes" ? t("kycHistoryCount", { count: draft.medicalHistory.entries.length }) : t(draft.medicalHistory.answer === "no" ? "no" : "notSure")],
    surgeries: [draft.surgeries.answer === "yes" ? t("kycSurgeryCount", { count: draft.surgeries.entries.length }) : t(draft.surgeries.answer === "no" ? "no" : "notSure")],
    facilities: [draft.facilityHistory.answer === "yes" ? t("kycVisitCount", { count: draft.facilityHistory.entries.length }) : t(draft.facilityHistory.answer === "no" ? "no" : "notSure")],
    family: [draft.familyHistory.answer === "provided" ? t("kycSelectedConditionCount", { count: draft.familyHistory.conditions.length }) : t(draft.familyHistory.answer === "unknown" ? "unknown" : "preferNotToAnswer")],
    other: [draft.otherInformation.trim() || t("notProvided")],
  }), [draft, t]);

  async function handleGenerate() {
    setError(null);
    try {
      await generateSummary();
    } catch (generationError) {
      setError(language === "en" && generationError instanceof Error && generationError.message
        ? generationError.message
        : t("kycPdfError"));
    }
  }

  function renderStep() {
    if (step === 0) return <div className="grid gap-5 sm:grid-cols-2">
      {([
        ["fullName", "fullName", "text"], ["dateOfBirth", "kycDateOfBirth", "date"], ["bloodGroup", "kycBloodGroup", "text"], ["emergencyContactName", "kycEmergencyContactName", "text"], ["emergencyContactRelationship", "kycRelationship", "text"], ["emergencyContactPhone", "kycEmergencyContactPhone", "tel"],
      ] as const).map(([key, labelKey, type]) => <label key={key} className="block"><span className="mb-2 block font-bold">{t(labelKey)}</span><input type={type} value={draft.patientBasics[key]} onChange={(event) => updateSection("patientBasics", (current) => ({ ...current, [key]: event.target.value }))} className={fieldClass} /></label>)}
    </div>;

    if (step === 1) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycAllergyQuestion")}</p><AnswerChoices current={draft.allergies.answer} onChange={(answer) => setAnswer("allergies", answer)} />{draft.allergies.answer === "yes" ? <><div className="space-y-4">{draft.allergies.entries.map((entry) => <EntryEditor key={entry.id} entry={entry as RepeatableEntry & AllergyEntry} fields={[{ key: "type", labelKey: "kycAllergyType", placeholderKey: "kycAllergyTypePlaceholder" }, { key: "name", labelKey: "kycAllergenName" }, { key: "reaction", labelKey: "kycReaction" }, { key: "severity", labelKey: "kycSeverity", placeholderKey: "kycSeverityPlaceholder" }]} onChange={(updated) => updateSection("allergies", (current) => ({ ...current, entries: current.entries.map((item) => item.id === updated.id ? updated : item) }))} onRemove={() => updateSection("allergies", (current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }))} />)}</div><Button type="button" variant="secondary" onClick={() => updateSection("allergies", (current) => ({ ...current, entries: [...current.entries, { id: crypto.randomUUID(), type: "", name: "", reaction: "", severity: "" }] }))}><Plus />{t("kycAddAllergy")}</Button></> : null}</div>;

    if (step === 2) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycConditionsQuestion")}</p><p className="text-muted">{t("kycNoDiagnosisNotice")}</p><AnswerChoices current={draft.currentConditions.answer} onChange={(answer) => setAnswer("currentConditions", answer)} />{draft.currentConditions.answer === "yes" ? <div className="grid gap-3 sm:grid-cols-2">{commonConditions.map(({ value, key }) => { const selected = draft.currentConditions.entries.some((entry) => entry.name === value); return <label key={value} className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 p-4 font-bold ${selected ? "border-primary bg-blue-50 dark:bg-blue-950/40" : "bg-card"}`}><input type="checkbox" checked={selected} onChange={(event) => updateSection("currentConditions", (current) => ({ ...current, entries: event.target.checked ? [...current.entries, { id: crypto.randomUUID(), name: value, other: "" }] : current.entries.filter((entry) => entry.name !== value) }))} />{t(key)}</label>; })}{draft.currentConditions.entries.some((entry) => entry.name === "Other") ? <label className="sm:col-span-2"><span className="mb-2 block font-bold">{t("kycOtherCondition")}</span><input className={fieldClass} value={draft.currentConditions.entries.find((entry) => entry.name === "Other")?.other ?? ""} onChange={(event) => updateSection("currentConditions", (current) => ({ ...current, entries: current.entries.map((entry) => entry.name === "Other" ? { ...entry, other: event.target.value } : entry) }))} /></label> : null}</div> : null}</div>;

    if (step === 3) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycMedicinesQuestion")}</p><AnswerChoices current={draft.currentMedications.answer} onChange={(answer) => setAnswer("currentMedications", answer)} />{draft.currentMedications.answer === "yes" ? <><p className="rounded-2xl bg-blue-50 p-4 font-semibold text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">{t("kycImportedMedicinesNotice")}</p><div className="space-y-4">{draft.currentMedications.entries.map((entry) => <EntryEditor key={entry.id} entry={entry as RepeatableEntry & KycMedicationEntry} fields={[{ key: "name", labelKey: "kycMedicineName" }, { key: "dosage", labelKey: "dosage" }, { key: "frequency", labelKey: "kycFrequency" }, { key: "reason", labelKey: "kycReason" }, { key: "note", labelKey: "kycNote" }]} onChange={(updated) => updateSection("currentMedications", (current) => ({ ...current, entries: current.entries.map((item) => item.id === updated.id ? updated : item) }))} onRemove={() => updateSection("currentMedications", (current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }))} />)}</div><Button type="button" variant="secondary" onClick={() => updateSection("currentMedications", (current) => ({ ...current, entries: [...current.entries, { id: crypto.randomUUID(), name: "", dosage: "", frequency: "", reason: "", note: "" }] }))}><Plus />{t("kycAddMedicine")}</Button></> : null}</div>;

    if (step === 4) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycHistoryQuestion")}</p><AnswerChoices current={draft.medicalHistory.answer} onChange={(answer) => setAnswer("medicalHistory", answer)} />{draft.medicalHistory.answer === "yes" ? <><div className="space-y-4">{draft.medicalHistory.entries.map((entry) => <EntryEditor key={entry.id} entry={entry as RepeatableEntry & MedicalHistoryEntry} fields={[{ key: "condition", labelKey: "kycConditionOrEvent" }, { key: "date", labelKey: "kycDate", type: "date" }, { key: "treatment", labelKey: "kycTreatment" }, { key: "details", labelKey: "kycDetails" }]} onChange={(updated) => updateSection("medicalHistory", (current) => ({ ...current, entries: current.entries.map((item) => item.id === updated.id ? updated : item) }))} onRemove={() => updateSection("medicalHistory", (current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }))} />)}</div><Button type="button" variant="secondary" onClick={() => updateSection("medicalHistory", (current) => ({ ...current, entries: [...current.entries, { id: crypto.randomUUID(), condition: "", date: "", treatment: "", details: "" }] }))}><Plus />{t("kycAddHistory")}</Button></> : null}</div>;

    if (step === 5) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycSurgeryQuestion")}</p><AnswerChoices current={draft.surgeries.answer} onChange={(answer) => setAnswer("surgeries", answer)} />{draft.surgeries.answer === "yes" ? <><div className="space-y-4">{draft.surgeries.entries.map((entry) => <EntryEditor key={entry.id} entry={entry as RepeatableEntry & SurgeryEntry} fields={[{ key: "procedure", labelKey: "kycProcedure" }, { key: "date", labelKey: "kycDate", type: "date" }, { key: "hospital", labelKey: "kycHospital" }, { key: "details", labelKey: "kycAdditionalInformation" }]} onChange={(updated) => updateSection("surgeries", (current) => ({ ...current, entries: current.entries.map((item) => item.id === updated.id ? updated : item) }))} onRemove={() => updateSection("surgeries", (current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }))} />)}</div><Button type="button" variant="secondary" onClick={() => updateSection("surgeries", (current) => ({ ...current, entries: [...current.entries, { id: crypto.randomUUID(), procedure: "", date: "", hospital: "", details: "" }] }))}><Plus />{t("kycAddSurgery")}</Button></> : null}</div>;

    if (step === 6) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycHospitalQuestion")}</p><AnswerChoices current={draft.facilityHistory.answer} onChange={(answer) => setAnswer("facilityHistory", answer)} />{draft.facilityHistory.answer === "yes" ? <><div className="space-y-4">{draft.facilityHistory.entries.map((entry) => <EntryEditor key={entry.id} entry={entry as RepeatableEntry & FacilityHistoryEntry} fields={[{ key: "facility", labelKey: "kycFacility" }, { key: "date", labelKey: "kycDate", type: "date" }, { key: "reason", labelKey: "kycReason" }, { key: "doctor", labelKey: "kycDoctor" }, { key: "note", labelKey: "kycNote" }]} onChange={(updated) => updateSection("facilityHistory", (current) => ({ ...current, entries: current.entries.map((item) => item.id === updated.id ? updated : item) }))} onRemove={() => updateSection("facilityHistory", (current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }))} />)}</div><Button type="button" variant="secondary" onClick={() => updateSection("facilityHistory", (current) => ({ ...current, entries: [...current.entries, { id: crypto.randomUUID(), facility: "", date: "", reason: "", doctor: "", note: "" }] }))}><Plus />{t("kycAddHospital")}</Button></> : null}</div>;

    if (step === 7) return <div className="space-y-5"><p className="text-lg font-bold">{t("kycFamilyMedicalHistory")}</p><div className="grid gap-3 sm:grid-cols-3">{([{"value":"provided","labelKey":"kycChooseConditions"},{"value":"unknown","labelKey":"unknown"},{"value":"prefer_not_to_answer","labelKey":"preferNotToAnswer"}] as const).map((option) => <button key={option.value} type="button" aria-pressed={draft.familyHistory.answer === option.value} onClick={() => updateSection("familyHistory", (current) => ({ ...current, answer: option.value, conditions: option.value === "provided" ? current.conditions : [], other: option.value === "provided" ? current.other : "" }))} className={`min-h-14 rounded-2xl border-2 px-4 font-extrabold ${draft.familyHistory.answer === option.value ? "border-primary bg-blue-50 text-primary dark:bg-blue-950/40" : "bg-card text-muted"}`}>{t(option.labelKey)}</button>)}</div>{draft.familyHistory.answer === "provided" ? <><div className="grid gap-3 sm:grid-cols-2">{familyConditions.map(({ value, key }) => <label key={value} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-4 font-bold"><input type="checkbox" checked={draft.familyHistory.conditions.includes(value)} onChange={(event) => updateSection("familyHistory", (current) => ({ ...current, conditions: event.target.checked ? [...current.conditions, value] : current.conditions.filter((item) => item !== value) }))} />{t(key)}</label>)}</div><label><span className="mb-2 block font-bold">{t("kycOtherFamilyHistory")}</span><input className={fieldClass} value={draft.familyHistory.other} onChange={(event) => updateSection("familyHistory", (current) => ({ ...current, other: event.target.value }))} /></label></> : null}</div>;

    if (step === 8) return <label className="block"><span className="mb-3 block text-lg font-bold">{t("kycOtherQuestion")}</span><textarea value={draft.otherInformation} onChange={(event) => { clearSummary(); setDraft((current) => ({ ...current, otherInformation: event.target.value })); }} className={`${fieldClass} min-h-56`} placeholder={t("kycOtherPlaceholder")} /></label>;

    return <div className="space-y-5"><div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0" /><div><h3 className="font-extrabold">{t("kycDevicePrivacyTitle")}</h3><p className="mt-1">{t("kycDevicePrivacyBody")}</p></div></div></div><ReviewSection number={1} titleKey="kycStepBasics" lines={review.basics} onEdit={() => setStep(0)} /><ReviewSection number={2} titleKey="kycStepAllergies" lines={review.allergies} onEdit={() => setStep(1)} /><ReviewSection number={3} titleKey="kycStepConditions" lines={review.conditions} onEdit={() => setStep(2)} /><ReviewSection number={4} titleKey="kycStepMedications" lines={review.medications} onEdit={() => setStep(3)} /><ReviewSection number={5} titleKey="kycStepHistory" lines={review.history} onEdit={() => setStep(4)} /><ReviewSection number={6} titleKey="kycStepSurgeries" lines={review.surgeries} onEdit={() => setStep(5)} /><ReviewSection number={7} titleKey="kycStepHospital" lines={review.facilities} onEdit={() => setStep(6)} /><ReviewSection number={8} titleKey="kycStepFamily" lines={review.family} onEdit={() => setStep(7)} /><ReviewSection number={9} titleKey="kycStepOther" lines={review.other} onEdit={() => setStep(8)} />{error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}<Button type="button" size="large" className="w-full" disabled={generating} onClick={handleGenerate}><FileCheck2 />{generating ? t("kycCreatingPdf") : generatedSummary ? t("kycRecreatePdf") : t("kycCreatePdf")}</Button>{generatedSummary ? <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">{t("kycSummaryReady")}</h3><p className="text-muted">{t("kycSummaryReadyHelp")}</p></div><Button asChild variant="secondary"><a href={generatedSummary.url} download={generatedSummary.file.name}><Download />{t("kycDownloadPdf")}</a></Button></div><iframe title={t("kycPdfPreview")} src={`${generatedSummary.url}#toolbar=1&navpanes=0`} className="mt-5 h-[70vh] w-full rounded-2xl border bg-white" /></Card> : null}</div>;
  }

  return <div className="space-y-6"><header><p className="eyebrow">{t("kycPrivateMedicalInformation")}</p><h1 className="patient-heading mt-2">{t("kycTitle")}</h1><p className="mt-3 max-w-3xl text-lg text-muted">{t("kycIntro")}</p></header><Card className="overflow-hidden"><div className="border-b bg-slate-50 p-5 dark:bg-slate-900/40"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-extrabold uppercase tracking-wide text-primary">{t("kycStep", { current: step + 1, total: steps.length })}</p><h2 className="mt-1 text-2xl font-extrabold">{t(steps[step])}</h2></div><span className="grid h-12 w-12 place-items-center rounded-full bg-primary font-extrabold text-white">{step + 1}</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200" aria-label={t("kycProgress", { percent: Math.round(progress) })}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div></div><div className="p-5 md:p-7">{renderStep()}<div className="mt-8 flex flex-wrap justify-between gap-3">{step > 0 ? <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)}><ChevronLeft />{t("back")}</Button> : <span />}{step < steps.length - 1 ? <Button type="button" size="large" onClick={() => setStep((current) => current + 1)}>{t("kycSaveContinue")}<ChevronRight /></Button> : <span className="inline-flex items-center gap-2 font-bold text-green-700"><Check />{t("kycReviewReached")}</span>}</div></div></Card></div>;
}
