import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { DataErrorState } from "@/components/ui/DataState";
import { getAdminDirectory } from "@/lib/data/admin";
import { getDirectoryAdminState } from "@/lib/data/directory-admin";
import { DirectoryAdministration } from "@/components/admin/DirectoryAdministration";

export default async function AdminPage() {
  const [directory, listingState] = await Promise.all([getAdminDirectory(), getDirectoryAdminState()]);

  if (!directory.data || directory.error) {
    return <DataErrorState messageKey="adminDirectoryError" />;
  }

  return <><AdminDashboard directory={directory.data} /><DirectoryAdministration state={listingState} /></>;
}
