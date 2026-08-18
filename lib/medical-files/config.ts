export const MEDICAL_FILE_BUCKET = "appointment-medical-files";
export const ALLOWED_MEDICAL_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMedicalFileType = typeof ALLOWED_MEDICAL_FILE_TYPES[number];

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function medicalFileLimits() {
  return {
    maxBytes: boundedInteger(process.env.MEDICAL_FILE_MAX_BYTES, 10 * 1024 * 1024, 1024, 10 * 1024 * 1024),
    maxFiles: boundedInteger(process.env.MEDICAL_FILE_MAX_COUNT, 6, 1, 12),
  };
}
