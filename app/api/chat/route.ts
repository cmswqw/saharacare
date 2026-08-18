import {
  MAX_CHAT_REQUEST_BYTES,
  parseChatRequest,
} from "@/lib/chat/contracts";
import {
  buildAuthorizedChatContext,
  ChatAccessError,
  getAuthenticatedChatActor,
} from "@/lib/chat/context";
import {
  normalizeAIProviderError,
} from "@/lib/chat/gemini-adapter";
import {
  getChatProvider,
  getChatProviderMetadata,
} from "@/lib/chat/gemini";
import { SAHARACARE_CHAT_INSTRUCTIONS } from "@/lib/chat/instructions";
import { checkChatRateLimit } from "@/lib/chat/rate-limit";
import { getDeterministicSafetyReply } from "@/lib/chat/safety";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function textResponse(
  message: string,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>,
) {
  return new Response(message, {
    status,
    headers: {
      ...responseHeaders,
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

function logChatEvent(
  requestId: string,
  event: string,
  startedAt: number,
  detail?: string,
) {
  console.error("[saharacare-chat]", {
    requestId,
    event,
    detail,
    latencyMs: Date.now() - startedAt,
  });
}

type ProviderFailureDiagnostic = {
  errorClass: string;
  errorName: string | null;
  httpStatus: number | null;
  model: string;
  normalizedCode: string;
  provider: string;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  providerRequestId: string | null;
  providerResponseId: string | null;
};

function sanitizeProviderLogValue(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return null;

  let sanitized = value
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(?:sk|sb_secret)_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED_SECRET]")
    .replace(/[\u0000-\u001F\u007F]/g, " ");
  const configuredKey = process.env.GEMINI_API_KEY?.trim();

  if (configuredKey) sanitized = sanitized.replaceAll(configuredKey, "[REDACTED_SECRET]");
  return sanitized.slice(0, 800);
}

function getProviderFailureDiagnostic(
  error: unknown,
  stage: "request" | "stream",
  provider: string,
  model: string,
): ProviderFailureDiagnostic {
  const normalized = normalizeAIProviderError(error, stage);

  return {
    errorClass: error instanceof Error ? error.constructor.name : typeof error,
    errorName: error instanceof Error ? error.name : null,
    httpStatus: normalized.httpStatus,
    model,
    normalizedCode: normalized.normalizedCode,
    provider,
    providerErrorCode: sanitizeProviderLogValue(normalized.providerCode),
    providerErrorMessage: sanitizeProviderLogValue(normalized.providerMessage),
    providerRequestId: sanitizeProviderLogValue(normalized.providerRequestId),
    providerResponseId: sanitizeProviderLogValue(normalized.providerResponseId),
  };
}

function logProviderFailure(
  requestId: string,
  event: string,
  startedAt: number,
  diagnostic: ProviderFailureDiagnostic,
) {
  console.error("[saharacare-chat]", {
    requestId,
    event,
    ...diagnostic,
    latencyMs: Date.now() - startedAt,
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_CHAT_REQUEST_BYTES) {
    return textResponse("The chat request is too large.", 413, requestId);
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return textResponse("The chat request is invalid.", 400, requestId);
  }

  const parsed = parseChatRequest(rawPayload);
  if (!parsed.ok) return textResponse(parsed.error, 400, requestId);

  try {
    const supabase = await createClient();
    const actor = await getAuthenticatedChatActor(supabase);
    const rateLimit = checkChatRateLimit(actor.id);

    if (!rateLimit.allowed) {
      return textResponse(
        "You have sent several messages quickly. Please wait a moment and try again.",
        429,
        requestId,
        { "Retry-After": String(rateLimit.retryAfterSeconds) },
      );
    }

    const latestQuestion = parsed.value.messages.at(-1)!.content;
    const context = await buildAuthorizedChatContext(
      supabase,
      actor,
      parsed.value.patientId,
      latestQuestion,
    );
    const safetyReply = getDeterministicSafetyReply(latestQuestion);

    if (safetyReply) {
      return textResponse(safetyReply.message, 200, requestId);
    }

    const providerMetadata = getChatProviderMetadata();
    let providerStream;

    try {
      const provider = getChatProvider();
      providerStream = await provider.streamText({
        messages: parsed.value.messages,
        context,
        systemInstruction: SAHARACARE_CHAT_INSTRUCTIONS,
        maxOutputTokens: 700,
        signal: request.signal,
      });
    } catch (error) {
      logProviderFailure(
        requestId,
        "ai_provider_request_failed",
        startedAt,
        getProviderFailureDiagnostic(
          error,
          "request",
          providerMetadata.name,
          providerMetadata.model,
        ),
      );
      return textResponse(
        "The assistant is temporarily unavailable. Please try again.",
        503,
        requestId,
      );
    }

    const encoder = new TextEncoder();
    let emittedText = false;

    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of providerStream) {
            if (request.signal.aborted) break;
            emittedText = true;
            controller.enqueue(encoder.encode(delta));
          }

          if (!emittedText && !request.signal.aborted) {
            controller.enqueue(encoder.encode(
              "The assistant could not produce a response. Please try again.",
            ));
          }
        } catch (error) {
          if (!request.signal.aborted) {
            logProviderFailure(
              requestId,
              "ai_provider_stream_failed",
              startedAt,
              getProviderFailureDiagnostic(
                error,
                "stream",
                providerMetadata.name,
                providerMetadata.model,
              ),
            );
            if (!emittedText) {
              controller.enqueue(encoder.encode(
                "The assistant is temporarily unavailable. Please try again.",
              ));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: {
        ...responseHeaders,
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      logChatEvent(requestId, "request_denied", startedAt, error.diagnosticCode);
      return textResponse(error.publicMessage, error.status, requestId);
    }

    logChatEvent(
      requestId,
      "request_failed",
      startedAt,
      error instanceof Error ? error.name : "unknown_request_error",
    );
    return textResponse(
      "The assistant is temporarily unavailable. Please try again.",
      503,
      requestId,
    );
  }
}
