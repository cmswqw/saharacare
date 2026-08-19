import { Bell, Bot, CalendarDays, FileHeart, HeartPulse, Home, LayoutDashboard, Pill, Settings, UserRound } from "lucide-react";

export const patientNavigation = [
  { href: "/patient", label: "dashboard" as const, icon: Home },
  { href: "/patient/medicines", label: "medicines" as const, icon: Pill },
  { href: "/patient/medical-information", label: "medicalInfo" as const, icon: FileHeart },
  { href: "/patient/appointments", label: "appointments" as const, icon: CalendarDays },
  { href: "/patient/assistant", label: "assistant" as const, icon: Bot },
  { href: "/patient/profile", label: "profile" as const, icon: UserRound },
];

export const patientNavigationSections = [
  { label: "dailyCare" as const, items: patientNavigation.slice(0, 3) },
  { label: "healthAndSupport" as const, items: patientNavigation.slice(3) },
];

export const caregiverNavigation = [
  { href: "/caregiver", label: "patientOverview" as const, icon: Home },
  { href: "/caregiver/assistant", label: "assistant" as const, icon: Bot },
  { href: "/caregiver/notifications", label: "notifications" as const, icon: Bell },
  { href: "/settings", label: "settings" as const, icon: Settings },
];

export const doctorNavigation = [
  { href: "/doctor", label: "appointments" as const, icon: CalendarDays },
  { href: "/settings", label: "settings" as const, icon: Settings },
];

export const adminNavigation = [
  { href: "/admin", label: "adminOverview" as const, icon: LayoutDashboard },
  { href: "/settings", label: "settings" as const, icon: Settings },
];

export const brandIcon = HeartPulse;
