import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isAppointmentUuid } from "@/lib/appointment-utils";
import { parseDirectoryMatches, parseDirectorySpecialties, type DirectorySpecialty, type DirectoryFilters, type DirectoryMatch } from "@/lib/directory/contracts";

export async function getDirectorySpecialties(): Promise<{ data: DirectorySpecialty[]; error: string | null }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { data: [], error: "Please sign in to browse the directory." };
  const { data, error } = await supabase.rpc("get_directory_specialties");
  const specialties = error ? null : parseDirectorySpecialties(data);
  return specialties ? { data: specialties, error: null } : { data: [], error: "The specialty catalog is temporarily unavailable." };
}

export async function getDirectoryMatches(filters: DirectoryFilters = {}): Promise<{
  data: DirectoryMatch[];
  error: string | null;
}> {
  if ((filters.specialtyIds !== undefined && (!Array.isArray(filters.specialtyIds)
    || filters.specialtyIds.length > 20
    || filters.specialtyIds.some(id => typeof id !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(id))))
    || (filters.providerType !== undefined && !["doctor", "hospital", "clinic"].includes(filters.providerType))
    || (filters.providerId !== undefined && !isAppointmentUuid(filters.providerId))) {
    return { data: [], error: "Invalid directory filters." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { data: [], error: "Please sign in to browse the directory." };

  // Eligibility, account activity, expiry and sponsorship are decided once in
  // PostgreSQL using statement_timestamp(), never a caller-supplied timestamp.
  const { data, error } = await supabase.rpc("get_directory_matches", {
    requested_specialty_ids: filters.specialtyIds ?? null,
    requested_provider_type: filters.providerType ?? null,
    requested_provider_id: filters.providerId ?? null,
  });
  if (error) return { data: [], error: "The directory is temporarily unavailable." };
  const matches = parseDirectoryMatches(data);
  if (!matches) return { data: [], error: "The directory is temporarily unavailable." };
  return { data: matches, error: null };
}
