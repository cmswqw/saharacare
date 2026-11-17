export type DirectoryProviderType = "doctor" | "hospital" | "clinic";

export type DirectorySpecialty = { id: string; name_en: string; name_ne: string };

export function parseDirectorySpecialties(value: unknown): DirectorySpecialty[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const seen = new Set<string>();
  const specialties: DirectorySpecialty[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || typeof row.id !== "string"
      || !/^[a-z][a-z0-9_-]{0,63}$/.test(row.id) || seen.has(row.id)
      || typeof row.name_en !== "string" || !row.name_en.trim() || row.name_en.length > 120
      || typeof row.name_ne !== "string" || !row.name_ne.trim() || row.name_ne.length > 120) return null;
    seen.add(row.id);
    specialties.push({ id: row.id, name_en: row.name_en, name_ne: row.name_ne });
  }
  return specialties;
}

export type DirectoryFilters = {
  /** Omit for general browse; [] deliberately returns no matches. */
  specialtyIds?: string[];
  providerType?: DirectoryProviderType;
  providerId?: string;
};

/** One public match per provider/specialty/eligible facility affiliation. */
export type DirectoryMatch = {
  provider_id: string;
  provider_type: DirectoryProviderType;
  doctor_profile_id: string | null;
  display_name: string;
  public_phone: string | null;
  public_email: string | null;
  public_address: string | null;
  specialty_id: string;
  specialty_name_en: string;
  specialty_name_ne: string;
  affiliation_id: string | null;
  facility_id: string | null;
  facility_name: string | null;
  facility_phone: string | null;
  facility_address: string | null;
  fee_amount: number | null;
  currency: string | null;
  is_sponsored: boolean;
  sponsorship_label_en: string | null;
  sponsorship_label_ne: string | null;
};

const requiredText = ["provider_id", "display_name", "specialty_id", "specialty_name_en", "specialty_name_ne"] as const;
const nullableText = [
  "doctor_profile_id", "public_phone", "public_email", "public_address", "affiliation_id",
  "facility_id", "facility_name", "facility_phone", "facility_address", "currency",
  "sponsorship_label_en", "sponsorship_label_ne",
] as const;

/** Validate and explicitly project the public contract; never spread DB rows. */
export function parseDirectoryMatches(value: unknown): DirectoryMatch[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const matches: DirectoryMatch[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    if (requiredText.some(key => typeof item[key] !== "string" || !item[key])
      || nullableText.some(key => item[key] !== null && typeof item[key] !== "string")
      || !["doctor", "hospital", "clinic"].includes(String(item.provider_type))
      || typeof item.is_sponsored !== "boolean"
      || (item.fee_amount !== null && (typeof item.fee_amount !== "number" || !Number.isFinite(item.fee_amount) || item.fee_amount < 0))
      || (item.currency !== null && !/^[A-Z]{3}$/.test(String(item.currency)))
      || (item.fee_amount !== null && item.currency === null)
      || (item.provider_type === "doctor" && (!item.doctor_profile_id || !item.affiliation_id || !item.facility_id))
      || (item.is_sponsored && (!item.sponsorship_label_en || !item.sponsorship_label_ne))
    ) return null;
    const projected: Record<string, unknown> = {
      provider_type: item.provider_type, fee_amount: item.fee_amount, is_sponsored: item.is_sponsored,
    };
    for (const key of [...requiredText, ...nullableText]) projected[key] = item[key];
    matches.push(projected as DirectoryMatch);
  }
  return matches;
}
