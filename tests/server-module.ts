import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Execute the real route/service implementation against explicit local fakes.
// Unmocked external dependencies fail closed: these tests cannot contact Auth,
// the database, storage, or a push provider, and never read local credentials.
export function loadServerModule(
  path: string,
  mocks: Record<string, unknown>,
  environment: Record<string, string> = {},
) {
  const cache = new Map<string, { exports: Record<string, unknown> }>();

  function load(filename: string): Record<string, unknown> {
    const cached = cache.get(filename);
    if (cached) return cached.exports;
    const module = { exports: {} as Record<string, unknown> };
    cache.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    runInNewContext(code, {
      exports: module.exports,
      module,
      require(specifier: string) {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        if (specifier === "server-only") return {};
        if (specifier.startsWith("@/")) return load(resolve(root, `${specifier.slice(2)}.ts`));
        if (specifier.startsWith(".")) return load(resolve(dirname(filename), `${specifier}.ts`));
        throw new Error(`Unmocked test dependency: ${specifier}`);
      },
      process: { env: { ...environment } },
      Response, Request, ReadableStream, File, Blob, FormData, Headers, URL,
      Uint8Array, ArrayBuffer, TextEncoder, TextDecoder,
      Date, Error, TypeError, RangeError, crypto,
      console: mocks["test:console"] ?? { error() { throw new Error("Unexpected server logging in test."); } },
    }, { filename });
    return module.exports;
  }

  return load(resolve(root, path));
}
