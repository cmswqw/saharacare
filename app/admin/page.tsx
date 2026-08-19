import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { DataErrorState } from "@/components/ui/DataState";
import { getAdminDirectory } from "@/lib/data/admin";

export default async function AdminPage() {
  const directory = await getAdminDirectory();

  if (!directory.data || directory.error) {
    return <DataErrorState messageKey="adminDirectoryError" />;
  }

  return <AdminDashboard directory={directory.data} />;
}
