import { Header } from "./Header";
import { PatientSidebar } from "./PatientSidebar";
import { CaregiverSidebar } from "./CaregiverSidebar";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { DoctorSidebar } from "./DoctorSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { MobileRoleNavigation } from "./MobileRoleNavigation";
import { TranslatedText } from "@/components/ui/TranslatedText";

export function AppShell({ children, mode = "patient", unreadNotifications = 0 }: { children: React.ReactNode; mode?: "patient" | "caregiver" | "doctor" | "admin"; unreadNotifications?: number }) {
  const patient = mode === "patient";
  const supportedRoleMobile = mode === "caregiver" || mode === "doctor";
  const sidebar = patient ? <PatientSidebar /> : mode === "caregiver" ? <CaregiverSidebar /> : mode === "doctor" ? <DoctorSidebar /> : <AdminSidebar />;
  return <div className={patient ? "patient-ui" : ""}><a href="#main-content" className="fixed start-4 top-3 z-[60] -translate-y-20 rounded-xl bg-primary px-4 py-3 font-bold text-white focus:translate-y-0"><TranslatedText translationKey="skipToContent" /></a>{sidebar}<div className="lg:ps-72"><Header mode={mode} unreadCount={unreadNotifications} /><main id="main-content" className={patient || supportedRoleMobile ? "safe-bottom mx-auto max-w-[90rem] px-4 py-5 sm:px-6 md:px-8 md:py-8" : "mx-auto max-w-[90rem] px-4 py-6 sm:px-6 md:px-8 md:py-8"}>{children}</main></div>{patient ? <MobileBottomNavigation /> : supportedRoleMobile ? <MobileRoleNavigation mode={mode} /> : null}</div>;
}
