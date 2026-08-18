import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CHAT_MESSAGE_CHARS,
  parseChatRequest,
} from "../lib/chat/contracts";

test("chat payload accepts a bounded conversation ending with a user message", () => {
  const result = parseChatRequest({
    messages: [
      { role: "user", content: "What is next?" },
      { role: "assistant", content: "Please clarify." },
      { role: "user", content: "My next medicine." },
    ],
    patientId: null,
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.messages.at(-1)?.content, "My next medicine.");
});

test("chat payload rejects a conversation not ending with a user message", () => {
  const result = parseChatRequest({
    messages: [{ role: "assistant", content: "Untrusted assistant-only request" }],
  });

  assert.equal(result.ok, false);
});

test("chat payload rejects oversized messages", () => {
  const result = parseChatRequest({
    messages: [{ role: "user", content: "x".repeat(MAX_CHAT_MESSAGE_CHARS + 1) }],
  });

  assert.equal(result.ok, false);
});

test("chat payload does not accept a non-string patient selector", () => {
  const result = parseChatRequest({
    messages: [{ role: "user", content: "What is next?" }],
    patientId: { id: "not-authorized-input" },
  });

  assert.equal(result.ok, false);
});
