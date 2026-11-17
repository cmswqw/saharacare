export const approvalStates = ["pending", "approved", "rejected"] as const;
export const verificationStates = ["unverified", "verified", "rejected"] as const;
export const publicationStates = ["draft", "published", "suspended"] as const;

export type DirectoryAdminProvider = {
  id: string; display_name: string; provider_type: string; active: boolean; is_demo: boolean;
  approval_status: typeof approvalStates[number]; verification_status: typeof verificationStates[number];
  publication_status: typeof publicationStates[number]; verification_reference: string | null;
};
export type DirectoryAdminState = {
  providers: DirectoryAdminProvider[];
  affiliations: { id: string; doctor_name: string; facility_name: string; active: boolean; approval_status: typeof approvalStates[number] }[];
  entitlements: { id: string; provider_id: string; plan: string; payment_status: string; payment_reference: string | null; starts_at: string; ends_at: string; in_period: boolean; is_demo: boolean }[];
  audit: { id: string; entity_table: string; entity_id: string; operation: string; actor_id: string | null; changed_at: string; source: string; reason: string | null }[];
};

export type DirectoryAdminActionState = { status: "idle" | "success" | "error" };

// datetime-local controls are explicitly labelled Nepal time in the admin UI.
export function directoryNepalDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:45`);
  if (!Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + 345 * 60_000).toISOString().slice(0, 16);
  return local === value ? date.toISOString() : null;
}
