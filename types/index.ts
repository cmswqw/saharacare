export type Language = "en" | "ne";
export type DoseStatus = "scheduled" | "taken" | "late" | "missed";
export type UserRole = "patient" | "caregiver";

export type AuthProfile = {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  email: string | null;
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

export type Appointment = {
  id: string;
  doctor: string;
  facility: string;
  date: string;
  time: string;
  purpose: string;
  status: "Requested" | "Confirmed" | "Completed" | "Cancelled";
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
