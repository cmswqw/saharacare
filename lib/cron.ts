import "server-only";

import { timingSafeEqual } from "node:crypto";

export function hasValidCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";

  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
