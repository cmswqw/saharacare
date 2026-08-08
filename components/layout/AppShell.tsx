import { Header } from "./Header";
import { PatientSidebar } from "./PatientSidebar";
import { CaregiverSidebar } from "./CaregiverSidebar";
import { MobileBottomNavigation } from "./MobileBottomNavigation";

export function AppShell({ children, mode = "patient", unreadNotifications = 0 }: { children: React.ReactNode; mode?: "patient" | "caregiver"; unreadNotifications?: number }) {
  const patient = mode === "patient";
  return <div className={patient ? "patient-ui" : ""}>{patient ? <PatientSidebar /> : <CaregiverSidebar />}<div className="lg:ps-72"><Header caregiver={!patient} unreadCount={unreadNotifications} /><main className={patient ? "safe-bottom mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10" : "mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10"}>{children}</main></div>{patient ? <MobileBottomNavigation /> : null}</div>;
}
