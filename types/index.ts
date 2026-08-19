export type Language = "en" | "ne";
export type DoseStatus = "scheduled" | "taken" | "late" | "missed";
export type UserRole = "patient" | "caregiver" | "doctor" | "admin";

export type AuthProfile = {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  email: string | null;
};

export type AdminAccountStatus = "active" | "inactive";

export type AdminDirectoryPerson = {
  id: string;
  displayName: string;
  accountStatus: AdminAccountStatus;
};

export type AdminDirectoryPatient = AdminDirectoryPerson & {
  caregivers: Pick<AdminDirectoryPerson, "id" | "displayName">[];
};

export type AdminDirectoryCaregiver = AdminDirectoryPerson & {
  patients: Pick<AdminDirectoryPerson, "id" | "displayName">[];
};

export type AdminDirectoryDoctor = AdminDirectoryPerson & {
  createdAt: string;
  role: "doctor";
};

export type AdminDirectory = {
  summary: {
    totalPatients: number;
    patientsWithCaregiver: number;
    patientsWithoutCaregiver: number;
    activeCaregivers: number;
    activeDoctors: number;
  };
  patients: AdminDirectoryPatient[];
  caregivers: AdminDirectoryCaregiver[];
  doctors: AdminDirectoryDoctor[];
};

export type MedicationSchedule = {
  id: string;
  medication_id: string;
  scheduled_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
};

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  instructions: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  schedules: MedicationSchedule[];
};

export type TodayDose = {
  id: string;
  schedule_id: string;
  scheduled_at: string;
  taken_at: string | null;
  persisted_status: DoseStatus;
  status: DoseStatus;
  medication: {
    id: string;
    name: string;
    dosage: string;
    instructions: string | null;
  };
};

export type DoseHistoryItem = TodayDose & {
  taken_late: boolean;
};

export type AdherenceSummary = {
  percentage: number | null;
  taken: number;
  eligible: number;
  missed: number;
  late: number;
  pending: number;
};

export type CaregiverLinkStatus = "pending" | "accepted";

export type LinkedCaregiver = {
  link_id: string;
  status: CaregiverLinkStatus;
  created_at: string;
  caregiver: {
    full_name: string;
    avatar_url: string | null;
  } | null;
};

export type LinkedPatient = {
  link_id: string;
  patient_id: string | null;
  status: CaregiverLinkStatus;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  linking_code: string | null;
  medications: Medication[];
  today_doses: TodayDose[];
  weekly_adherence: AdherenceSummary;
  recent_history: DoseHistoryItem[];
};

export type Phase4ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  nonce?: number;
};

export type Phase5ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  takenAt?: string;
  nonce?: number;
};

export type Contact = {
  id: string;
  name: string;
  role: string;
  phone: string;
  type: "caregiver" | "doctor" | "hospital" | "emergency";
};

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled";

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  patient_name?: string;
  facility: string;
  purpose: string;
  note: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  created_at: string;
};

export type AppointmentMedicalShare = {
  id: string;
  appointment_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  files: AppointmentMedicalFile[];
};

export type AppointmentMedicalFile = {
  id: string;
  share_id: string;
  original_filename: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  size_bytes: number;
  kind: "medical_summary" | "supporting";
  created_at: string;
};

export type MedicationNotificationType =
  | "medication_taken"
  | "medication_late"
  | "medication_missed";

export type AppNotification = {
  id: string;
  type: MedicationNotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  patient_id: string | null;
};

export type NotificationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  nonce?: number;
};

export type DemoAction = "due_now" | "taken" | "late" | "missed" | "reset";

export type DemoActionState = {
  status: "idle" | "success" | "error";
  message: string;
  action?: DemoAction;
  nonce?: number;
};
