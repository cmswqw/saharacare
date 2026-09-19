import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeAIProviderDiagnostic } from "../lib/chat/gemini-adapter";
import { readBoundedBody, readBoundedJson, RequestBodyError } from "../lib/request-body";
import { safeDatabaseDiagnostic } from "../lib/security-diagnostics";
import nextConfig from "../next.config";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("database diagnostics exclude row data, messages, hints and unknown code strings", () => {
  const error = { code: "23502", message: "sensitive medical text", details: "failing row", hint: "private data" };
  assert.deepEqual(safeDatabaseDiagnostic(error), { code: "23502" });
  assert.deepEqual(safeDatabaseDiagnostic({ code: "arbitrary sensitive value" }), { code: "unknown" });
  assert.deepEqual(safeDatabaseDiagnostic({ code: "PGRST202" }), { code: "PGRST202" });
});

test("AI diagnostics exclude all provider free text including prompt echoes", () => {
  const error = Object.assign(new Error("sensitive medical text"), {
    status: 401, code: "UNAUTHENTICATED", requestId: "private data", responseId: "private data",
  });
  assert.deepEqual(safeAIProviderDiagnostic(error, "request"), {
    errorName: "Error", httpStatus: 401, normalizedCode: "ai_provider_auth", providerErrorCode: "UNAUTHENTICATED",
  });
  const unknown = Object.assign(new Error("sensitive text"), { name: "sensitive text", code: "sensitive text" });
  assert.deepEqual(safeAIProviderDiagnostic(unknown, "stream"), {
    errorName: "Error", httpStatus: null, normalizedCode: "ai_provider_stream_failed", providerErrorCode: null,
  });
});

test("bounded JSON accepts valid Unicode without trusting Content-Length", async () => {
  const payload = { message: "नमस्ते" };
  const request = new Request("https://example.test/api/chat", { method: "POST", body: JSON.stringify(payload) });
  assert.deepEqual(await readBoundedJson(request, 100), payload);
});

test("bounded body cancels oversized streams with absent or forged length", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(8)); },
      cancel() { cancelled = true; },
    });
    const request = new Request("https://example.test/api/chat", {
      method: "POST", headers, body, duplex: "half",
    } as RequestInit);
    await assert.rejects(readBoundedBody(request, 12), (error) => error instanceof RequestBodyError && error.status === 413);
    assert.equal(cancelled, true);
  }
});

test("bounded body accepts exact limit and rejects declared oversize and malformed JSON", async () => {
  assert.equal((await readBoundedBody(new Request("https://example.test", { method: "POST", body: "1234" }), 4)).byteLength, 4);
  await assert.rejects(readBoundedBody(new Request("https://example.test", {
    method: "POST", body: "1234", headers: { "content-length": "99" },
  }), 4), (error) => error instanceof RequestBodyError && error.status === 413);
  await assert.rejects(readBoundedJson(new Request("https://example.test", { method: "POST", body: "{" }), 100),
    (error) => error instanceof RequestBodyError && error.status === 400);
});

test("chat and subscription routes bound the stream before parsing JSON", () => {
  for (const path of ["app/api/chat/route.ts", "app/api/push-subscriptions/route.ts"]) {
    assert.match(source(path), /readBoundedJson\(request,/);
    assert.doesNotMatch(source(path), /await request\.json\(/);
  }
});

test("sensitive API responses are not cached and pages deny external framing", async () => {
  const entries = await nextConfig.headers!();
  const all = entries.find((entry) => entry.source === "/:path*")!.headers;
  assert.ok(all.some((header) => header.key === "Content-Security-Policy" && header.value.includes("frame-ancestors 'self'")));
  assert.ok(all.some((header) => header.key === "X-Frame-Options" && header.value === "SAMEORIGIN"));
  assert.ok(all.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff"));
  assert.ok(all.some((header) => header.key === "Referrer-Policy" && header.value === "no-referrer"));
  assert.ok(entries.find((entry) => entry.source === "/api/:path*")!.headers.some((header) => header.value.includes("no-store")));
});

test("all Supabase SSR clients use Secure production cookies and explicit SameSite", () => {
  for (const path of ["lib/supabase/client.ts", "lib/supabase/server.ts", "lib/supabase/middleware.ts"]) {
    assert.match(source(path), /cookieOptions: \{ secure: process\.env\.NODE_ENV === "production", sameSite: "lax" \}/);
  }
});

test("medical PDFs use canvas rendering without the PDF.js scripting or viewer API", () => {
  const viewer = source("components/medical-files/SecureDocumentViewer.tsx");
  assert.match(viewer, /pdfjs\.getDocument/);
  assert.match(viewer, /page\.render\(\{ canvas, canvasContext: context2d, viewport \}\)/);
  assert.doesNotMatch(viewer, /enableScripting|PDFScriptingManager|AnnotationLayer|pdfjs-dist\/web/);
});
