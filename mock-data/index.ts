import type { Appointment, Contact } from "@/types";

// Phase 4 replaces the former mock medication list and mock caregiver/patient
// relationships with Supabase data. Phase 7 also replaces notification mocks;
// appointments and contacts remain local until their own backend phases.
export const contacts: Contact[] = [
  { id: "caregiver", name: "सुमन शर्मा", role: "Son & caregiver", phone: "+977-9800000001", type: "caregiver" },
  { id: "doctor", name: "डा. अनिता श्रेष्ठ", role: "Family doctor", phone: "+977-9800000002", type: "doctor" },
  { id: "hospital", name: "Sahara Community Hospital", role: "Hospital", phone: "+977-01-5550100", type: "hospital" },
  { id: "emergency", name: "Local emergency service", role: "Emergency", phone: "102", type: "emergency" },
];

export const initialAppointments: Appointment[] = [
  { id: "apt-1", doctor: "डा. अनिता श्रेष्ठ", facility: "Sahara Community Clinic", date: "12 Aug 2026", time: "10:30 AM", purpose: "Diabetes check", status: "Confirmed" },
  { id: "apt-2", doctor: "Dr. Raj Bhandari", facility: "Kathmandu Heart Centre", date: "25 Aug 2026", time: "2:00 PM", purpose: "Blood pressure check", status: "Requested" },
];
