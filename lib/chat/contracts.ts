export const MAX_CHAT_MESSAGES = 10;
export const MAX_CHAT_MESSAGE_CHARS = 2_000;
export const MAX_CHAT_TOTAL_CHARS = 10_000;
export const MAX_CHAT_REQUEST_BYTES = 24_000;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  patientId: string | null;
};

type ParseResult =
  | { ok: true; value: ChatRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChatRequest(value: unknown): ParseResult {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    return { ok: false, error: "Send at least one chat message." };
  }

  if (value.messages.length < 1 || value.messages.length > MAX_CHAT_MESSAGES) {
    return {
      ok: false,
      error: `Send between one and ${MAX_CHAT_MESSAGES} chat messages.`,
    };
  }

  const messages: ChatMessage[] = [];
  let totalCharacters = 0;

  for (const candidate of value.messages) {
    if (
      !isRecord(candidate)
      || (candidate.role !== "user" && candidate.role !== "assistant")
      || typeof candidate.content !== "string"
    ) {
      return { ok: false, error: "The chat history is invalid." };
    }

    const content = candidate.content.trim();
    if (!content || content.length > MAX_CHAT_MESSAGE_CHARS) {
      return {
        ok: false,
        error: `Each message must contain 1-${MAX_CHAT_MESSAGE_CHARS} characters.`,
      };
    }

    totalCharacters += content.length;
    messages.push({ role: candidate.role, content });
  }

  if (totalCharacters > MAX_CHAT_TOTAL_CHARS) {
    return { ok: false, error: "This conversation is too long. Start a new chat." };
  }

  if (messages.at(-1)?.role !== "user") {
    return { ok: false, error: "The latest chat message must be from you." };
  }

  const patientId = value.patientId;
  if (patientId !== undefined && patientId !== null && typeof patientId !== "string") {
    return { ok: false, error: "The selected patient is invalid." };
  }

  return {
    ok: true,
    value: {
      messages,
      patientId: typeof patientId === "string" ? patientId.trim() || null : null,
    },
  };
}
