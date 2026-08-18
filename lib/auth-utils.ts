import type { UserRole } from "@/types";

export function dashboardPath(role: UserRole) {
  if (role === "caregiver") return "/caregiver";
  if (role === "doctor") return "/doctor";
  return "/patient";
}
