import { Bell, CalendarDays, HeartPulse, Home, Pill, Settings, UserRound } from "lucide-react";

export const patientNavigation = [
  { href: "/patient", label: "home" as const, icon: Home },
  { href: "/patient/medicines", label: "medicines" as const, icon: Pill },
  { href: "/patient/appointments", label: "appointments" as const, icon: CalendarDays },
  { href: "/patient/profile", label: "profile" as const, icon: UserRound },
];

export const caregiverNavigation = [
  { href: "/caregiver", label: "Overview", icon: Home },
  { href: "/caregiver/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const brandIcon = HeartPulse;
