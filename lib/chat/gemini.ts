import "server-only";

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/genai";
import type { ChatMessage } from "@/lib/chat/contracts";
import {
  adaptGeminiTextStream,
  buildGeminiContents,
  requireGeminiApiKey,
  resolveGeminiModel,
} from "@/lib/chat/gemini-adapter";

const GEMINI_TIMEOUT_MS = 20_000;

const safetySettings = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({
  category,
  threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
}));

let geminiClient: GoogleGenAI | null = null;
let configuredApiKey: string | null = null;

export type ChatProviderInput = {
  messages: ChatMessage[];
  context: string;
  systemInstruction: string;
  maxOutputTokens: number;
  signal: AbortSignal;
};

export function getChatProviderMetadata() {
  return {
    name: "gemini" as const,
    model: resolveGeminiModel(process.env.GEMINI_MODEL),
  };
}

export function getChatProvider() {
  const apiKey = requireGeminiApiKey(process.env.GEMINI_API_KEY);
  const { model } = getChatProviderMetadata();

  if (!geminiClient || configuredApiKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    configuredApiKey = apiKey;
  }

  return {
    name: "gemini" as const,
    model,
    async streamText(input: ChatProviderInput) {
      const stream = await geminiClient!.models.generateContentStream({
        model,
        contents: buildGeminiContents(input.messages, input.context),
        config: {
          systemInstruction: input.systemInstruction,
          maxOutputTokens: input.maxOutputTokens,
          safetySettings,
          abortSignal: input.signal,
          httpOptions: {
            timeout: GEMINI_TIMEOUT_MS,
            retryOptions: { attempts: 2 },
          },
        },
      });

      return adaptGeminiTextStream(stream);
    },
  };
}
