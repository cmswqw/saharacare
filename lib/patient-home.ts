import type { Appointment, TodayDose } from "@/types";

/** Select the next visible care items without changing the source collections. */
export function getPatientHomeSummary(
  doses: TodayDose[],
  appointments: Appointment[],
  now = Date.now(),
): { nextDose: TodayDose | null; nextAppointment: Appointment | null } {
  let nextDose: TodayDose | null = null;
  let nextAppointment: Appointment | null = null;

  for (const dose of doses) {
    const scheduledAt = Date.parse(dose.scheduled_at);
    if (dose.status === "taken" || !Number.isFinite(scheduledAt)) continue;
    if (!nextDose || scheduledAt < Date.parse(nextDose.scheduled_at)) nextDose = dose;
  }

  for (const appointment of appointments) {
    const startsAt = Date.parse(appointment.starts_at);
    const endsAt = Date.parse(appointment.ends_at);
    if (
      appointment.status === "cancelled"
      || appointment.status === "completed"
      || !Number.isFinite(startsAt)
      || !Number.isFinite(endsAt)
      || endsAt <= startsAt
      || endsAt <= now
    ) continue;
    if (!nextAppointment || startsAt < Date.parse(nextAppointment.starts_at)) {
      nextAppointment = appointment;
    }
  }

  return { nextDose, nextAppointment };
}

export type AppointmentFacility = {
  name: string;
  appointmentId: string;
  visitCount: number;
};

/** Summarize only the supplied patient's facilities; this is not a global ranking. */
export function getAppointmentFacilities(appointments: Appointment[]): AppointmentFacility[] {
  const facilities = new Map<string, AppointmentFacility & { latestAt: number }>();

  for (const appointment of appointments) {
    const name = appointment.facility.trim();
    if (!name || appointment.status === "cancelled") continue;
    const key = name.toLowerCase();
    const startsAt = Date.parse(appointment.starts_at);
    const latestAt = Number.isFinite(startsAt) ? startsAt : Number.NEGATIVE_INFINITY;
    const existing = facilities.get(key);

    if (!existing) {
      facilities.set(key, { name, appointmentId: appointment.id, visitCount: 1, latestAt });
      continue;
    }
    existing.visitCount += 1;
    if (latestAt > existing.latestAt) {
      existing.name = name;
      existing.appointmentId = appointment.id;
      existing.latestAt = latestAt;
    }
  }

  return [...facilities.values()]
    .sort((left, right) => right.visitCount - left.visitCount || left.name.localeCompare(right.name))
    .slice(0, 4)
    .map(({ name, appointmentId, visitCount }) => ({ name, appointmentId, visitCount }));
}
