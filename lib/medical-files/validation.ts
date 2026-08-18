import {
  ALLOWED_MEDICAL_FILE_TYPES,
  type AllowedMedicalFileType,
} from "@/lib/medical-files/config";

export type ValidatedMedicalFile = {
  bytes: Uint8Array;
  mimeType: AllowedMedicalFileType;
  originalFilename: string;
  size: number;
  sha256: string;
};

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectMedicalFileType(bytes: Uint8Array): AllowedMedicalFileType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export function sanitizeMedicalFilename(filename: string) {
  const normalized = filename.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/gu, "_").replace(/^[._\s]+/u, "").trim();
  return (normalized || "medical-document").slice(0, 180);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateMedicalFile(file: File, maxBytes: number): Promise<ValidatedMedicalFile> {
  if (file.size < 1 || file.size > maxBytes) {
    throw new Error(`Each file must be between 1 byte and ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }
  if (!ALLOWED_MEDICAL_FILE_TYPES.includes(file.type as AllowedMedicalFileType)) {
    throw new Error("Only PDF, JPEG, PNG, and WEBP medical files are accepted.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectMedicalFileType(bytes);
  if (!detected || detected !== file.type) {
    throw new Error("A file's contents do not match its declared file type.");
  }

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return {
    bytes,
    mimeType: detected,
    originalFilename: sanitizeMedicalFilename(file.name),
    size: file.size,
    sha256: bytesToHex(digest),
  };
}
