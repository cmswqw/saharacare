import type { Language } from "@/types";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  language: Language;
  soundEnabled: boolean;
};

function isBoundedString(value: unknown, minimum: number, maximum: number) {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

// Only browser push services may receive server-side notification requests.
// Never turn a subscription supplied by a browser into an arbitrary HTTPS fetch.
export function isAllowedPushEndpoint(value: unknown): value is string {
  if (!isBoundedString(value, 20, 2048)) return false;

  try {
    const endpoint = new URL(value as string);
    if (
      endpoint.protocol !== "https:"
      || endpoint.username
      || endpoint.password
      || endpoint.port
      || endpoint.hash
    ) return false;

    const hostname = endpoint.hostname;
    return hostname === "fcm.googleapis.com"
      || hostname === "updates.push.services.mozilla.com"
      || hostname === "web.push.apple.com"
      || hostname === "notify.windows.com"
      || hostname.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

export function parsePushSubscriptionInput(value: unknown): PushSubscriptionInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const keys = candidate.keys;
  if (!keys || typeof keys !== "object") return null;
  const keyRecord = keys as Record<string, unknown>;

  if (
    !isAllowedPushEndpoint(candidate.endpoint)
    || !isBoundedString(keyRecord.p256dh, 20, 512)
    || !isBoundedString(keyRecord.auth, 10, 256)
    || (candidate.language !== "en" && candidate.language !== "ne")
    || typeof candidate.soundEnabled !== "boolean"
  ) return null;

  return {
    endpoint: candidate.endpoint as string,
    keys: {
      p256dh: keyRecord.p256dh as string,
      auth: keyRecord.auth as string,
    },
    language: candidate.language,
    soundEnabled: candidate.soundEnabled,
  };
}

export function parsePushEndpoint(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const endpoint = (value as Record<string, unknown>).endpoint;
  return isAllowedPushEndpoint(endpoint) ? endpoint : null;
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host") || requestUrl.host;
    const expectedProtocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
    const originUrl = new URL(origin);
    return originUrl.host === expectedHost && originUrl.protocol === `${expectedProtocol}:`;
  } catch {
    return false;
  }
}
