"use client";

import { useMemo, useState } from "react";
import {
  HandHeart,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Card } from "@/components/ui/Card";
import type {
  AdminAccountStatus,
  AdminDirectory,
  AdminDirectoryCaregiver,
  AdminDirectoryDoctor,
  AdminDirectoryPatient,
} from "@/types";

type AccountFilter = "all" | AdminAccountStatus;
type PatientFilter = "all" | "linked" | "unlinked";

function StatusBadge({ status }: { status: AdminAccountStatus }) {
  const { t } = useApp();

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${status === "active" ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>
      {t(status)}
    </span>
  );
}

function SearchField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className="min-h-12 w-full rounded-2xl border-2 bg-card py-2 pe-4 ps-12 font-semibold"
      />
    </label>
  );
}

function EmptyList({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center font-semibold text-muted">{message}</div>;
}

function PatientList({ patients }: { patients: AdminDirectoryPatient[] }) {
  const { t } = useApp();

  if (patients.length === 0) return <EmptyList message={t("noPatientsFound")} />;

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border lg:block">
        <table className="w-full table-fixed text-start">
          <thead className="bg-slate-50 text-sm font-bold uppercase tracking-wide text-muted dark:bg-slate-900/60">
            <tr>
              <th className="w-1/4 px-5 py-4 text-start">{t("patient")}</th>
              <th className="w-2/5 px-5 py-4 text-start">{t("caregiversColumn")}</th>
              <th className="px-5 py-4 text-start">{t("relationshipStatus")}</th>
              <th className="px-5 py-4 text-start">{t("accountStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td className="px-5 py-4 font-extrabold">{patient.displayName}</td>
                <td className="px-5 py-4 text-muted">
                  {patient.caregivers.length > 0
                    ? patient.caregivers.map((caregiver) => caregiver.displayName).join(", ")
                    : t("noCaregiver")}
                </td>
                <td className="px-5 py-4 font-bold text-muted">{t(patient.caregivers.length > 0 ? "linked" : "noCaregiver")}</td>
                <td className="px-5 py-4"><StatusBadge status={patient.accountStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 lg:hidden">
        {patients.map((patient) => (
          <Card key={patient.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-lg font-extrabold">{patient.displayName}</p><p className="mt-1 text-sm font-bold text-muted">{t(patient.caregivers.length > 0 ? "linked" : "noCaregiver")}</p></div>
              <StatusBadge status={patient.accountStatus} />
            </div>
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-bold uppercase tracking-wide text-muted">{t("caregiversColumn")}</p>
              <p className="mt-2 font-semibold">{patient.caregivers.length > 0 ? patient.caregivers.map((caregiver) => caregiver.displayName).join(", ") : t("noCaregiver")}</p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function CaregiverList({ caregivers }: { caregivers: AdminDirectoryCaregiver[] }) {
  const { t } = useApp();

  if (caregivers.length === 0) return <EmptyList message={t("noCaregiversFound")} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {caregivers.map((caregiver) => (
        <Card key={caregiver.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-lg font-extrabold">{caregiver.displayName}</p><p className="mt-1 text-sm font-semibold text-muted">{t("caregiver")}</p></div>
            <StatusBadge status={caregiver.accountStatus} />
          </div>
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-bold uppercase tracking-wide text-muted">{t("patientsConnected")}</p>
            <p className="mt-2 font-semibold">{caregiver.patients.length > 0 ? caregiver.patients.map((patient) => patient.displayName).join(", ") : t("noPatientsLinked")}</p>
            <p className="mt-3 text-sm font-bold text-primary">{t("patientCount", { count: caregiver.patients.length })}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function DoctorList({ doctors }: { doctors: AdminDirectoryDoctor[] }) {
  const { language, t } = useApp();
  const formatter = useMemo(() => new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en", { dateStyle: "medium" }), [language]);

  if (doctors.length === 0) return <EmptyList message={t("noDoctorsFound")} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {doctors.map((doctor) => (
        <Card key={doctor.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40"><Stethoscope aria-hidden="true" /></span>
            <StatusBadge status={doctor.accountStatus} />
          </div>
          <h3 className="mt-4 text-lg font-extrabold">{doctor.displayName}</h3>
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="font-bold text-muted">{t("role")}</dt><dd className="font-semibold">{t("doctor")}</dd></div>
            <div className="flex justify-between gap-3"><dt className="font-bold text-muted">{t("registeredDate")}</dt><dd className="font-semibold">{formatter.format(new Date(doctor.createdAt))}</dd></div>
          </dl>
        </Card>
      ))}
    </div>
  );
}

export function AdminDashboard({ directory }: { directory: AdminDirectory }) {
  const { t } = useApp();
  const [patientSearch, setPatientSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<PatientFilter>("all");
  const [caregiverSearch, setCaregiverSearch] = useState("");
  const [caregiverFilter, setCaregiverFilter] = useState<AccountFilter>("all");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState<AccountFilter>("all");

  const patients = useMemo(() => {
    const search = patientSearch.trim().toLocaleLowerCase();
    return directory.patients.filter((patient) => {
      const relationshipMatches = patientFilter === "all"
        || (patientFilter === "linked" && patient.caregivers.length > 0)
        || (patientFilter === "unlinked" && patient.caregivers.length === 0);
      return relationshipMatches && (!search || patient.displayName.toLocaleLowerCase().includes(search) || patient.caregivers.some((caregiver) => caregiver.displayName.toLocaleLowerCase().includes(search)));
    });
  }, [directory.patients, patientFilter, patientSearch]);

  const caregivers = useMemo(() => {
    const search = caregiverSearch.trim().toLocaleLowerCase();
    return directory.caregivers.filter((caregiver) => (
      (caregiverFilter === "all" || caregiver.accountStatus === caregiverFilter)
      && (!search || caregiver.displayName.toLocaleLowerCase().includes(search) || caregiver.patients.some((patient) => patient.displayName.toLocaleLowerCase().includes(search)))
    ));
  }, [caregiverFilter, caregiverSearch, directory.caregivers]);

  const doctors = useMemo(() => {
    const search = doctorSearch.trim().toLocaleLowerCase();
    return directory.doctors.filter((doctor) => (
      (doctorFilter === "all" || doctor.accountStatus === doctorFilter)
      && (!search || doctor.displayName.toLocaleLowerCase().includes(search))
    ));
  }, [directory.doctors, doctorFilter, doctorSearch]);

  const summaryCards = [
    { label: t("totalPatients"), value: directory.summary.totalPatients, Icon: Users },
    { label: t("patientsWithCaregiver"), value: directory.summary.patientsWithCaregiver, Icon: UserCheck },
    { label: t("patientsWithoutCaregiver"), value: directory.summary.patientsWithoutCaregiver, Icon: UserMinus },
    { label: t("activeCaregivers"), value: directory.summary.activeCaregivers, Icon: HandHeart },
    { label: t("activeDoctors"), value: directory.summary.activeDoctors, Icon: Stethoscope },
  ];

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">{t("adminOverview")}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{t("adminDashboard")}</h1>
        <p className="mt-3 max-w-3xl text-lg text-muted">{t("adminDashboardIntro")}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-primary dark:bg-blue-950/40"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t("readOnlyAccountOverview")}</div>
      </header>

      <section aria-label={t("adminSummary")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, Icon }) => (
          <Card key={label} className="p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40"><Icon aria-hidden="true" /></span>
            <p className="mt-5 text-3xl font-extrabold">{value}</p>
            <p className="mt-1 font-bold text-muted">{label}</p>
          </Card>
        ))}
      </section>

      <section aria-labelledby="admin-patients-title" className="space-y-5">
        <div><h2 id="admin-patients-title" className="section-title">{t("patients")}</h2><p className="mt-1 text-muted">{t("patientRelationshipHelp")}</p></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchField label={t("searchPatients")} value={patientSearch} onChange={setPatientSearch} />
          <select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value as PatientFilter)} aria-label={t("filterPatients")} className="min-h-12 rounded-2xl border-2 bg-card px-4 font-bold">
            <option value="all">{t("all")}</option><option value="linked">{t("hasCaregiver")}</option><option value="unlinked">{t("noCaregiver")}</option>
          </select>
        </div>
        <PatientList patients={patients} />
      </section>

      <section aria-labelledby="admin-caregivers-title" className="space-y-5">
        <div><h2 id="admin-caregivers-title" className="section-title">{t("caregivers")}</h2><p className="mt-1 text-muted">{t("caregiverRelationshipHelp")}</p></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchField label={t("searchCaregivers")} value={caregiverSearch} onChange={setCaregiverSearch} />
          <select value={caregiverFilter} onChange={(event) => setCaregiverFilter(event.target.value as AccountFilter)} aria-label={t("filterCaregivers")} className="min-h-12 rounded-2xl border-2 bg-card px-4 font-bold">
            <option value="all">{t("all")}</option><option value="active">{t("active")}</option><option value="inactive">{t("inactive")}</option>
          </select>
        </div>
        <CaregiverList caregivers={caregivers} />
      </section>

      <section aria-labelledby="admin-doctors-title" className="space-y-5">
        <div><h2 id="admin-doctors-title" className="section-title">{t("doctors")}</h2><p className="mt-1 text-muted">{t("doctorAccountHelp")}</p></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchField label={t("searchDoctors")} value={doctorSearch} onChange={setDoctorSearch} />
          <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value as AccountFilter)} aria-label={t("filterDoctors")} className="min-h-12 rounded-2xl border-2 bg-card px-4 font-bold">
            <option value="all">{t("all")}</option><option value="active">{t("active")}</option><option value="inactive">{t("inactive")}</option>
          </select>
        </div>
        <DoctorList doctors={doctors} />
      </section>
    </div>
  );
}
