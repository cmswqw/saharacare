import { delay } from "@/lib/utils";
import type { Appointment } from "@/types";

export async function requestAppointment(data: Omit<Appointment, "id" | "status">) {
  await delay(850);
  return { ...data, id: `apt-${Date.now()}`, status: "Requested" as const };
}
