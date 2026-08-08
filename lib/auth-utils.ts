import type { UserRole } from "@/types";

export function dashboardPath(role: UserRole) {
  return role === "caregiver" ? "/caregiver" : "/patient";
}
