"use client";

import { useActionState, useCallback, useState } from "react";
import { CalendarClock, XCircle } from "lucide-react";
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  type AppointmentActionState,
} from "@/app/actions/appointments";
import { AvailableSlotPicker } from "@/components/appointments/AvailableSlotPicker";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";

const initialState: AppointmentActionState = { status: "idle", message: "" };

export function AppointmentManagement({
  appointmentId,
  doctorId,
}: {
  appointmentId: string;
  doctorId: string;
}) {
  const { language, t } = useApp();
  const [showReschedule, setShowReschedule] = useState(false);
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const selectSlot = useCallback((startsAt: string) => setSelectedSlot(startsAt), []);
  const [rescheduleState, rescheduleAction, rescheduling] = useActionState(
    rescheduleAppointmentAction,
    initialState,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelAppointmentAction,
    initialState,
  );

  return (
    <div className="mt-5 border-t pt-5">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          aria-expanded={showReschedule}
          onClick={() => setShowReschedule((current) => !current)}
        >
          <CalendarClock aria-hidden="true" />{t("reschedule")}
        </Button>
        <form
          action={cancelAction}
          onSubmit={(event) => {
            if (!window.confirm(t("cancelAppointmentConfirm"))) event.preventDefault();
          }}
        >
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <Button type="submit" variant="danger" disabled={cancelling}>
            <XCircle aria-hidden="true" />
            {t(cancelling ? "cancellingAppointment" : "cancelAppointment")}
          </Button>
        </form>
      </div>

      {cancelState.status === "error" ? (
        <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 font-bold text-red-800">
          {language === "ne" ? t("appointmentCancelError") : cancelState.message}
        </p>
      ) : cancelState.status === "success" ? (
        <p role="status" className="mt-3 rounded-2xl bg-green-50 p-3 font-bold text-green-800">
          {t("appointmentCancelled")}
        </p>
      ) : null}

      {showReschedule ? (
        <form action={rescheduleAction} className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <AvailableSlotPicker
            doctorId={doctorId}
            date={date}
            onDateChange={setDate}
            selectedSlot={selectedSlot}
            onSlotChange={selectSlot}
            idPrefix={`reschedule-${appointmentId}`}
          />
          <input type="hidden" name="startsAt" value={selectedSlot} />
          {rescheduleState.status === "error" ? (
            <p role="alert" className="rounded-2xl bg-red-50 p-3 font-bold text-red-800">
              {language === "ne" ? t("appointmentRescheduleError") : rescheduleState.message}
            </p>
          ) : rescheduleState.status === "success" ? (
            <p role="status" className="rounded-2xl bg-green-50 p-3 font-bold text-green-800">
              {t("appointmentRescheduled")}
            </p>
          ) : null}
          <Button type="submit" disabled={rescheduling || !selectedSlot}>
            <CalendarClock aria-hidden="true" />
            {t(rescheduling ? "reschedulingAppointment" : "confirmReschedule")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
