import { Header } from "./Header";
import { PatientSidebar } from "./PatientSidebar";
import { CaregiverSidebar } from "./CaregiverSidebar";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { DoctorSidebar } from "./DoctorSidebar";

export function AppShell({ children, mode = "patient", unreadNotifications = 0 }: { children: React.ReactNode; mode?: "patient" | "caregiver" | "doctor"; unreadNotifications?: number }) {
  const patient = mode === "patient";
  return <div className={patient ? "patient-ui" : ""}>{patient ? <PatientSidebar /> : mode === "caregiver" ? <CaregiverSidebar /> : <DoctorSidebar />}<div className="lg:ps-72"><Header mode={mode} unreadCount={unreadNotifications} /><main className={patient ? "safe-bottom mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10" : "mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10"}>{children}</main></div>{patient ? <MobileBottomNavigation /> : null}</div>;
}
