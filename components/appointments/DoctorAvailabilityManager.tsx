"use client";

import { useActionState } from "react";
import { CalendarClock, CalendarX2, Clock3, Plus, Save, Trash2 } from "lucide-react";
import {
  deleteDoctorAvailabilityAction,
  deleteDoctorOverrideAction,
  saveDoctorAvailabilityAction,
  saveDoctorOverrideAction,
  type AppointmentActionState,
} from "@/app/actions/appointments";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getKathmanduDateInputValue } from "@/lib/appointment-utils";
import type {
  DoctorAvailability,
  DoctorAvailabilityOverride,
} from "@/types";
import type { TranslationKey } from "@/lib/i18n";

const initialState: AppointmentActionState = { status: "idle", message: "" };
const fieldClass = "min-h-12 min-w-0 rounded-2xl border-2 bg-card px-3 font-semibold focus:border-primary";
const weekdayKeys: TranslationKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function WeeklyBlockForm({
  dayOfWeek,
  block,
}: {
  dayOfWeek: number;
  block?: DoctorAvailability;
}) {
  const { language, t } = useApp();
  const [state, action, pending] = useActionState(saveDoctorAvailabilityAction, initialState);
  const prefix = block?.id ?? `new-${dayOfWeek}`;

  return (
    <form action={action} className="rounded-2xl border bg-slate-50 p-3 dark:bg-slate-900">
      {block ? <input type="hidden" name="availabilityId" value={block.id} /> : null}
      <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${prefix}-start`} className="mb-1 block text-sm font-bold">{t("startTime")}</label>
          <input id={`${prefix}-start`} name="startTime" type="time" required defaultValue={block?.start_time.slice(0, 5) ?? "09:00"} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label htmlFor={`${prefix}-end`} className="mb-1 block text-sm font-bold">{t("endTime")}</label>
          <input id={`${prefix}-end`} name="endTime" type="time" required defaultValue={block?.end_time.slice(0, 5) ?? "12:00"} className={`${fieldClass} w-full`} />
        </div>
      </div>
      {state.status !== "idle" ? (
        <p className={`mt-2 text-sm font-bold ${state.status === "error" ? "text-danger" : "text-success"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "error" && language === "ne" ? t("availabilitySaveError") : state.status === "success" ? t("availabilitySaved") : state.message}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {block ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {t(pending ? "saving" : block ? "saveChanges" : "addAvailability")}
        </Button>
        {block ? (
          <Button type="submit" variant="danger" formAction={deleteDoctorAvailabilityAction} name="availabilityId" value={block.id}>
            <Trash2 aria-hidden="true" />{t("remove")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function OverrideForm({ override }: { override?: DoctorAvailabilityOverride }) {
  const { language, t } = useApp();
  const [state, action, pending] = useActionState(saveDoctorOverrideAction, initialState);
  const prefix = override?.id ?? "new-override";

  return (
    <form action={action} className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900">
      {override ? <input type="hidden" name="overrideId" value={override.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${prefix}-date`} className="mb-1 block text-sm font-bold">{t("date")}</label>
          <input id={`${prefix}-date`} name="date" type="date" min={getKathmanduDateInputValue()} required defaultValue={override?.override_date ?? ""} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label htmlFor={`${prefix}-type`} className="mb-1 block text-sm font-bold">{t("overrideType")}</label>
          <select id={`${prefix}-type`} name="overrideType" defaultValue={override?.override_type ?? "unavailable"} className={`${fieldClass} w-full`}>
            <option value="unavailable">{t("unavailable")}</option>
            <option value="custom_hours">{t("customHours")}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-start`} className="mb-1 block text-sm font-bold">{t("startTimeOptional")}</label>
          <input id={`${prefix}-start`} name="startTime" type="time" defaultValue={override?.start_time?.slice(0, 5) ?? ""} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label htmlFor={`${prefix}-end`} className="mb-1 block text-sm font-bold">{t("endTimeOptional")}</label>
          <input id={`${prefix}-end`} name="endTime" type="time" defaultValue={override?.end_time?.slice(0, 5) ?? ""} className={`${fieldClass} w-full`} />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{t("overrideTimeHelp")}</p>
      {state.status !== "idle" ? (
        <p className={`mt-2 text-sm font-bold ${state.status === "error" ? "text-danger" : "text-success"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "error" && language === "ne" ? t("overrideSaveError") : state.status === "success" ? t("overrideSaved") : state.message}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {override ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {t(pending ? "saving" : override ? "saveChanges" : "addOverride")}
        </Button>
        {override ? (
          <Button type="submit" variant="danger" formAction={deleteDoctorOverrideAction} name="overrideId" value={override.id}>
            <Trash2 aria-hidden="true" />{t("remove")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function DoctorAvailabilityManager({
  weekly,
  overrides,
}: {
  weekly: DoctorAvailability[];
  overrides: DoctorAvailabilityOverride[];
}) {
  const { t } = useApp();

  return (
    <div className="space-y-8">
      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-950/40">
            <CalendarClock aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold">{t("weeklyAvailability")}</h2>
            <p className="mt-2 leading-relaxed text-muted">{t("weeklyAvailabilityHelp")}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {weekdayKeys.map((weekdayKey, dayOfWeek) => {
            const blocks = weekly.filter((block) => block.day_of_week === dayOfWeek);
            return (
              <section key={weekdayKey} className="min-w-0 rounded-3xl border p-4" aria-labelledby={`weekday-${dayOfWeek}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="text-primary" aria-hidden="true" />
                  <h3 id={`weekday-${dayOfWeek}`} className="text-xl font-extrabold">{t(weekdayKey)}</h3>
                </div>
                <div className="space-y-3">
                  {blocks.length === 0 ? <p className="text-sm font-semibold text-muted">{t("normallyUnavailable")}</p> : null}
                  {blocks.map((block) => <WeeklyBlockForm key={block.id} dayOfWeek={dayOfWeek} block={block} />)}
                  <WeeklyBlockForm dayOfWeek={dayOfWeek} />
                </div>
              </section>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800 dark:bg-amber-950/40">
            <CalendarX2 aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold">{t("dateOverrides")}</h2>
            <p className="mt-2 leading-relaxed text-muted">{t("dateOverridesHelp")}</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <OverrideForm />
          {overrides.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-5 text-center text-muted">{t("noDateOverrides")}</p>
          ) : overrides.map((override) => <OverrideForm key={override.id} override={override} />)}
        </div>
      </Card>

      <Card className="border-blue-200 bg-blue-50 p-5 dark:bg-blue-950/30">
        <p className="font-bold">{t("existingAppointmentsPreserved")}</p>
      </Card>
    </div>
  );
}
