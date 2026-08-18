"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, CircleStop, RotateCcw, Send, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MAX_CHAT_MESSAGES, type ChatMessage } from "@/lib/chat/contracts";
import type { CaregiverChatSubject } from "@/lib/chat/context";
import type { UserRole } from "@/types";
import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey } from "@/lib/i18n";

type DisplayMessage = ChatMessage & {
  id: string;
  localOnly?: boolean;
  translationKey?: TranslationKey;
};

const starterQuestionKeys = [
  "chatQuestionNextDose",
  "chatQuestionActiveMedicines",
  "chatQuestionMissedDose",
] as const;

function createWelcomeMessage(role: UserRole): DisplayMessage {
  return {
    id: "welcome",
    role: "assistant",
    localOnly: true,
    content: "",
    translationKey: role === "caregiver"
      ? "caregiverChatWelcome"
      : "patientChatWelcome",
  };
}

function createMessageId() {
  return crypto.randomUUID();
}

export function ChatAssistant({
  viewerRole,
  caregiverPatients = [],
}: {
  viewerRole: UserRole;
  caregiverPatients?: CaregiverChatSubject[];
}) {
  const { language, t } = useApp();
  const [messages, setMessages] = useState<DisplayMessage[]>([
    createWelcomeMessage(viewerRole),
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(
    caregiverPatients.length === 1 ? caregiverPatients[0].id : "",
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  function updateAssistantMessage(id: string, content: string) {
    setMessages((current) => current.map((message) => (
      message.id === id ? { ...message, content } : message
    )));
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();

    if (!content || pending) return;
    if (viewerRole === "caregiver" && !selectedPatientId) return;

    const userMessage: DisplayMessage = {
      id: createMessageId(),
      role: "user",
      content,
    };
    const assistantMessage: DisplayMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
    };
    const requestMessages = [...messages, userMessage]
      .filter((message) => !message.localOnly)
      .slice(-(MAX_CHAT_MESSAGES - 1))
      .map(({ role, content: messageContent }) => ({
        role,
        content: messageContent,
      }));
    const controller = new AbortController();

    abortControllerRef.current = controller;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages,
          patientId: viewerRole === "caregiver" ? selectedPatientId : null,
        }),
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (!reader) throw new Error("Chat response body is unavailable");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        updateAssistantMessage(assistantMessage.id, assistantText);
      }
      assistantText += decoder.decode();

      if (!response.ok) {
        updateAssistantMessage(
          assistantMessage.id,
          language === "ne" ? t("assistantUnavailable") : assistantText || t("assistantUnavailable"),
        );
      } else if (!assistantText) {
        updateAssistantMessage(
          assistantMessage.id,
          t("assistantNoResponse"),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((current) => current.map((message) => (
          message.id === assistantMessage.id
            ? {
                ...message,
                content: message.content
                  ? `${message.content}\n\n${t("responseStopped")}`
                  : t("responseStopped"),
              }
            : message
        )));
      } else {
        updateAssistantMessage(
          assistantMessage.id,
          t("assistantUnavailable"),
        );
      }
    } finally {
      abortControllerRef.current = null;
      setPending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function resetConversation() {
    abortControllerRef.current?.abort();
    setMessages([createWelcomeMessage(viewerRole)]);
    setDraft("");
  }

  const caregiverWithoutPatients = viewerRole === "caregiver" && caregiverPatients.length === 0;
  const canSend = Boolean(draft.trim())
    && !pending
    && (viewerRole !== "caregiver" || Boolean(selectedPatientId));

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">{t("chatReadOnlySupport")}</p>
          <h1 className="patient-heading mt-2">{t("chatTitle")}</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
            {t("chatIntro")}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={resetConversation}
          disabled={messages.length === 1 && !draft}
        >
          <RotateCcw aria-hidden="true" />{t("newChat")}
        </Button>
      </header>

      <Card className="border-blue-200 bg-blue-50/70 p-4 dark:bg-blue-950/20">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            {t("chatPrivacyNotice")}
          </p>
        </div>
      </Card>

      {viewerRole === "caregiver" ? (
        <label className="block max-w-xl font-bold">
          {t("approvedPatient")}
          <select
            value={selectedPatientId}
            onChange={(event) => {
              setSelectedPatientId(event.target.value);
              resetConversation();
            }}
            disabled={pending || caregiverWithoutPatients}
            className="mt-2 min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-base"
          >
            <option value="">{t("choosePatient")}</option>
            {caregiverPatients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.fullName}</option>
            ))}
          </select>
          {caregiverWithoutPatients ? (
            <span className="mt-2 block text-sm font-normal text-muted">
              {t("caregiverNoPatients")}
            </span>
          ) : null}
        </label>
      ) : null}

      <Card className="overflow-hidden">
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label={t("assistantConversation")}
          className="max-h-[55vh] min-h-80 space-y-5 overflow-y-auto p-4 md:p-6"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" ? (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white">
                  <Bot aria-hidden="true" />
                </span>
              ) : null}
              <div className={`max-w-[82%] rounded-3xl px-5 py-4 ${
                message.role === "user"
                  ? "bg-primary text-white"
                  : "border bg-slate-50 dark:bg-slate-900"
              }`}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-70">
                  {message.role === "user" ? t("you") : t("chatTitle")}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.translationKey ? t(message.translationKey) : message.content || t("thinking")}
                </p>
              </div>
              {message.role === "user" ? (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                  <UserRound aria-hidden="true" />
                </span>
              ) : null}
            </article>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t p-4 md:p-6">
          {messages.length === 1 ? (
            <div className="mb-4 flex flex-wrap gap-2" aria-label={t("suggestedQuestions")}>
              {starterQuestionKeys.map((questionKey) => (
                <button
                  key={questionKey}
                  type="button"
                  onClick={() => {
                    setDraft(t(questionKey));
                    inputRef.current?.focus();
                  }}
                  disabled={pending || caregiverWithoutPatients}
                  className="min-h-12 rounded-2xl border-2 bg-card px-4 text-start text-sm font-bold hover:border-primary/50 disabled:opacity-50"
                >
                  {t(questionKey)}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={sendMessage} className="space-y-3">
            <label htmlFor="chat-message" className="sr-only">{t("messageAssistant")}</label>
            <textarea
              ref={inputRef}
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 2_000))}
              onKeyDown={handleComposerKeyDown}
              rows={3}
              maxLength={2_000}
              disabled={pending || caregiverWithoutPatients}
              placeholder={caregiverWithoutPatients
                ? t("approvedPatientRequired")
                : t("chatPlaceholder")
              }
              className="w-full resize-none rounded-2xl border-2 bg-card px-4 py-3 leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {t("chatKeyboardHelp", { count: draft.length })}
              </p>
              {pending ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => abortControllerRef.current?.abort()}
                >
                  <CircleStop aria-hidden="true" />{t("stopResponse")}
                </Button>
              ) : (
                <Button type="submit" size="large" disabled={!canSend} aria-label={t("sendMessage")}>
                  <Send aria-hidden="true" />{t("send")}
                </Button>
              )}
            </div>
          </form>
        </div>
      </Card>

      <p className="text-center text-sm leading-relaxed text-muted">
        {t("chatEmergencyNotice")}
      </p>
    </div>
  );
}
