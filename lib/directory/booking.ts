import { APPOINTMENT_TIME_ZONE, isAppointmentUuid } from "@/lib/appointment-utils";

export type DirectoryBookingSelection = { providerId: string; affiliationId: string; specialtyId: string };
export type DirectoryBookingQuote = DirectoryBookingSelection & {
  doctorId: string; facilityId: string; providerName: string; facilityName: string;
  feeAmount: number | null; currency: string | null; timeZone: string;
};
export type BookingReview = Omit<DirectoryBookingQuote, "doctorId" | "providerId" | "affiliationId" | "specialtyId" | "facilityId"> & {
  requestId: string; confirmed: true;
  providerId: string | null; affiliationId: string | null; specialtyId: string | null; facilityId: string | null;
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const isSpecialtyId = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const name = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
function validFee(value: Record<string, unknown>) {
  return (value.feeAmount === null || (typeof value.feeAmount === "number" && Number.isFinite(value.feeAmount) && value.feeAmount >= 0 && value.currency !== null))
    && (value.currency === null || (typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency)));
}
export function parseDirectoryBookingQuote(value: unknown): DirectoryBookingQuote | null {
  if (!record(value) || !["providerId", "affiliationId", "doctorId", "facilityId"].every(key => typeof value[key] === "string" && isAppointmentUuid(value[key]))
    || !isSpecialtyId(value.specialtyId) || !name(value.providerName) || !name(value.facilityName)
    || value.timeZone !== APPOINTMENT_TIME_ZONE || !validFee(value)) return null;
  return { providerId: String(value.providerId), affiliationId: String(value.affiliationId), doctorId: String(value.doctorId), facilityId: String(value.facilityId),
    specialtyId: value.specialtyId, providerName: value.providerName, facilityName: value.facilityName,
    feeAmount: value.feeAmount as number | null, currency: value.currency as string | null, timeZone: value.timeZone };
}
export function parseBookingReview(value: unknown): BookingReview | null {
  if (!record(value) || Object.keys(value).length !== 11
    || Object.keys(value).some(key => !["requestId", "confirmed", "providerId", "affiliationId", "specialtyId", "facilityId", "providerName", "facilityName", "feeAmount", "currency", "timeZone"].includes(key))
    || typeof value.requestId !== "string" || !isAppointmentUuid(value.requestId) || value.confirmed !== true
    || !name(value.providerName) || !name(value.facilityName) || value.timeZone !== APPOINTMENT_TIME_ZONE || !validFee(value)) return null;
  if (value.affiliationId === null) {
    if (value.providerId !== null || value.facilityId !== null || value.specialtyId !== null || value.feeAmount !== null || value.currency !== null) return null;
  } else if (![value.providerId, value.facilityId, value.affiliationId].every(id => typeof id === "string" && isAppointmentUuid(id)) || !isSpecialtyId(value.specialtyId)) return null;
  return { requestId: value.requestId, confirmed: true, providerId: value.providerId as string | null, affiliationId: value.affiliationId as string | null,
    specialtyId: value.specialtyId as string | null, facilityId: value.facilityId as string | null,
    providerName: value.providerName, facilityName: value.facilityName, feeAmount: value.feeAmount as number | null, currency: value.currency as string | null, timeZone: value.timeZone };
}
