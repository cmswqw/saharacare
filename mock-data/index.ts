import type { Contact } from "@/types";

// Phase 4 replaces the former mock medication list and mock caregiver/patient
// relationships with Supabase data. Phase 7 also replaces notification mocks.
// Contact shortcuts remain local; appointments now use authenticated Supabase data.
export const contacts: Contact[] = [
  { id: "caregiver", name: "सुमन शर्मा", role: "Son & caregiver", phone: "+977-9800000001", type: "caregiver" },
  { id: "doctor", name: "डा. अनिता श्रेष्ठ", role: "Family doctor", phone: "+977-9800000002", type: "doctor" },
  { id: "hospital", name: "Sahara Community Hospital", role: "Hospital", phone: "+977-01-5550100", type: "hospital" },
  { id: "emergency", name: "Local emergency service", role: "Emergency", phone: "102", type: "emergency" },
];
