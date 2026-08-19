export const MEDICATION_REMINDER_LEAD_MINUTES = 10;
export const MEDICATION_REMINDER_BATCH_SIZE = 100;
export const PUSH_SERVICE_WORKER_PATH = "/sw.js";

export function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/gu, "+").replace(/_/gu, "/");
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
