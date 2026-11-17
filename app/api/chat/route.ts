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
  safeAIProviderDiagnostic,
} from "@/lib/chat/gemini-adapter";
import {
  getChatProvider,
  getChatProviderMetadata,
} from "@/lib/chat/gemini";
import { SAHARACARE_CHAT_INSTRUCTIONS } from "@/lib/chat/instructions";
import { checkChatRateLimit } from "@/lib/chat/rate-limit";
import { getDeterministicSafetyReply } from "@/lib/chat/safety";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson, RequestBodyError } from "@/lib/request-body";
import { handleBookingGuidance } from "@/lib/chat/booking-guidance";

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

function getProviderFailureDiagnostic(
  error: unknown,
  stage: "request" | "stream",
  provider: string,
  model: string,
) {
  return {
    ...safeAIProviderDiagnostic(error, stage),
    model,
    provider,
  };
}

function logProviderFailure(
  requestId: string,
  event: string,
  startedAt: number,
  diagnostic: ReturnType<typeof getProviderFailureDiagnostic>,
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
  let rawPayload: unknown;
  try {
    rawPayload = await readBoundedJson(request, MAX_CHAT_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError && error.status === 413) {
      return textResponse("The chat request is too large.", 413, requestId);
    }
    return textResponse("The chat request is invalid.", 400, requestId);
  }

  // Explicit mode keeps the existing text-stream contract unchanged.
  if (rawPayload && typeof rawPayload === "object" && "mode" in rawPayload && rawPayload.mode === "booking_guidance") {
    return handleBookingGuidance(request, rawPayload, requestId);
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
      "unknown_request_error",
    );
    return textResponse(
      "The assistant is temporarily unavailable. Please try again.",
      503,
      requestId,
    );
  }
}
