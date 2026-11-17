import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryAdminState } from "@/lib/directory/admin-contracts";

export async function getActiveDirectoryAdminClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const profile = await supabase.from("profiles").select("id, role, account_status").eq("id", user.id).maybeSingle();
  if (profile.error || profile.data?.role !== "admin" || profile.data?.account_status !== "active") return null;
  return supabase;
}

export async function getDirectoryAdminState(): Promise<DirectoryAdminState | null> {
  const supabase = await getActiveDirectoryAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_directory_admin_state");
  if (error || !data || !["providers", "affiliations", "entitlements", "audit"].every(key => Array.isArray(data[key]))) return null;
  return data as DirectoryAdminState;
}
