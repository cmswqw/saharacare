import { Header } from "./Header";
import { PatientSidebar } from "./PatientSidebar";
import { CaregiverSidebar } from "./CaregiverSidebar";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { DoctorSidebar } from "./DoctorSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { MobileRoleNavigation } from "./MobileRoleNavigation";

export function AppShell({ children, mode = "patient", unreadNotifications = 0 }: { children: React.ReactNode; mode?: "patient" | "caregiver" | "doctor" | "admin"; unreadNotifications?: number }) {
  const patient = mode === "patient";
  const supportedRoleMobile = mode === "caregiver" || mode === "doctor";
  const sidebar = patient ? <PatientSidebar /> : mode === "caregiver" ? <CaregiverSidebar /> : mode === "doctor" ? <DoctorSidebar /> : <AdminSidebar />;
  return <div className={patient ? "patient-ui" : ""}>{sidebar}<div className="lg:ps-72"><Header mode={mode} unreadCount={unreadNotifications} /><main className={patient || supportedRoleMobile ? "safe-bottom mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10" : "mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10"}>{children}</main></div>{patient ? <MobileBottomNavigation /> : supportedRoleMobile ? <MobileRoleNavigation mode={mode} /> : null}</div>;
}
