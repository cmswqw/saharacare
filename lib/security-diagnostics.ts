// Database error messages, details, hints and rows may contain medical data.
// Only retain a structured PostgreSQL/PostgREST code in application logs.
export function safeDatabaseDiagnostic(error: { code?: string }) {
  return {
    code: typeof error.code === "string" && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code)
      ? error.code
      : "unknown",
  };
}
