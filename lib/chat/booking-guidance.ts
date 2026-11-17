import "server-only";
import { ChatAccessError, getAuthenticatedChatActor, resolveChatSubject } from "@/lib/chat/context";
import { getChatProvider } from "@/lib/chat/gemini";
import { safeAIProviderDiagnostic } from "@/lib/chat/gemini-adapter";
import { checkChatRateLimit } from "@/lib/chat/rate-limit";
import { getDirectoryMatches, getDirectorySpecialties } from "@/lib/data/directory";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_GUIDANCE_INSTRUCTIONS, getBookingUrgencyFloor } from "@/lib/chat/booking-safety";
import { bookingGuidanceSchema, parseBookingGuidanceOutput, parseBookingGuidanceRequest, getUrgentGuidanceSignal,
  type BookingGuidance, type BookingGuidanceResponse } from "@/lib/chat/booking-contracts";
import type { DirectorySpecialty } from "@/lib/directory/contracts";

function result(overrides: Partial<BookingGuidanceResponse> = {}): BookingGuidanceResponse {
  return { status: "ready", guidance: null, source: "fallback", specialties: [], providers: [], ...overrides };
}
function respond(payload: BookingGuidanceResponse, requestId: string, status = 200, headers: Record<string, string> = {}) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Request-Id": requestId, ...headers } });
}
function uncertain(specialties: DirectorySpecialty[]): BookingGuidance {
  return { urgency: "uncertain", clarification: "severity", specialtyIds: specialties.some(s => s.id === "general-medicine") ? ["general-medicine"] : [] };
}

export async function handleBookingGuidance(request: Request, rawPayload: unknown, requestId: string): Promise<Response> {
  const input = parseBookingGuidanceRequest(rawPayload);
  if (!input) return respond(result({ status: "invalid_request" }), requestId, 400);
  try {
    const supabase = await createClient();
    const actor = await getAuthenticatedChatActor(supabase);
    const { data: profile, error } = await supabase.from("profiles").select("account_status").eq("id", actor.id).maybeSingle();
    if (error) return respond(result({ status: "denied" }), requestId, 503);
    if (profile?.account_status !== "active") return respond(result({ status: "denied" }), requestId, 403);
    // Reuse patient-self/accepted-caregiver subject authorization without reading
    // medication data or sending the resolved name/ID to the model.
    await resolveChatSubject(supabase, actor, input.patientId);

    const floor = getBookingUrgencyFloor(input.symptoms, input.chip);
    if (floor) return respond(result({ status: floor.urgency as "urgent" | "emergency", guidance: floor, source: "rule" }), requestId);
    const limit = checkChatRateLimit(actor.id);
    if (!limit.allowed) return respond(result({ status: "rate_limited" }), requestId, 429, { "Retry-After": String(limit.retryAfterSeconds) });

    let catalog;
    try { catalog = await getDirectorySpecialties(); } catch { catalog = { data: [], error: "unavailable" }; }
    if (catalog.error) return respond(result({ status: "directory_error" }), requestId, 503);
    const specialties = catalog.data;
    if (!specialties.length) return respond(result({ status: "catalog_empty" }), requestId);
    if (input.action === "specialties") return respond(result({ specialties }), requestId);

    let guidance: BookingGuidance;
    const source = input.action === "browse" ? "manual" : "ai";
    if (input.action === "browse") {
      if (!specialties.some(s => s.id === input.specialtyId)) return respond(result({ status: "invalid_request", specialties }), requestId, 400);
      // Manual browsing is NOT a triage result or a claim that symptoms are safe.
      guidance = { urgency: "uncertain", specialtyIds: [input.specialtyId!], clarification: null };
    } else {
      if (process.env.NODE_ENV === "production" && process.env.BOOKING_GUIDANCE_REVIEW_APPROVED !== "true") {
        return respond(result({ status: "review_required", specialties, guidance: uncertain(specialties) }), requestId, 503);
      }
      let text = "";
      try {
        const provider = getChatProvider();
        const stream = await provider.streamText({
          messages: [{ role: "user", content: JSON.stringify({ symptoms: input.symptoms, selectedChip: input.chip }) }],
          context: JSON.stringify({ allowedSpecialties: specialties }),
          systemInstruction: BOOKING_GUIDANCE_INSTRUCTIONS, maxOutputTokens: 400, signal: request.signal,
          responseJsonSchema: bookingGuidanceSchema(specialties),
        });
        for await (const chunk of stream) {
          if (request.signal.aborted) throw new Error("Request cancelled");
          text += chunk;
          if (text.length > 4000) throw new Error("Invalid structured response");
        }
        // An emitted escalation outranks a later contradictory/duplicate field.
        const urgentSignal = getUrgentGuidanceSignal(text);
        if (urgentSignal === "emergency" || urgentSignal === "urgent") {
          return respond(result({ status: urgentSignal, source: "ai", guidance: { urgency: urgentSignal, specialtyIds: [], clarification: null } }), requestId);
        }
        const validated = parseBookingGuidanceOutput(text, specialties);
        if (!validated) {
          return respond(result({ status: "ai_unavailable", specialties, guidance: uncertain(specialties) }), requestId, 503);
        }
        guidance = validated;
      } catch (providerError) {
        console.error("[saharacare-chat]", { requestId, event: "booking_guidance_failed", ...safeAIProviderDiagnostic(providerError, "stream") });
        const urgentSignal = getUrgentGuidanceSignal(text);
        if (urgentSignal) return respond(result({ status: urgentSignal, source: "ai", guidance: { urgency: urgentSignal, specialtyIds: [], clarification: null } }), requestId);
        return respond(result({ status: "ai_unavailable", specialties, guidance: uncertain(specialties) }), requestId, 503);
      }
      if (guidance.urgency === "emergency" || guidance.urgency === "urgent") {
        return respond(result({ status: guidance.urgency, guidance, source }), requestId);
      }
      if (guidance.urgency === "uncertain") {
        // Only cautious General Medicine can be suggested while uncertain. Do
        // not query routine providers until the user clarifies or browses manually.
        const general = uncertain(specialties).specialtyIds;
        return respond(result({ status: "clarification", guidance: { ...guidance, specialtyIds: general }, source, specialties }), requestId);
      }
    }

    // This is the sole provider source. No model provider IDs or names accepted;
    // no provider descriptions, sponsorship or payments enter the model request.
    let matches;
    try { matches = await getDirectoryMatches({ specialtyIds: guidance.specialtyIds }); }
    catch { matches = { data: [], error: "unavailable" }; }
    if (matches.error) return respond(result({ status: "directory_error", guidance, source, specialties }), requestId, 503);
    // Defense against a contract regression: never widen beyond selected IDs.
    const providers = matches.data.filter(provider => guidance.specialtyIds.includes(provider.specialty_id));
    return respond(result({ status: providers.length ? "matches" : "no_matches", guidance, source, specialties, providers }), requestId);
  } catch (error) {
    if (error instanceof ChatAccessError) return respond(result({ status: "denied" }), requestId, error.status);
    return respond(result({ status: "ai_unavailable" }), requestId, 503);
  }
}
