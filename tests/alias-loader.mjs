import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  let basePath = null;
  if (specifier.startsWith("@/")) {
    basePath = resolvePath(projectRoot, specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    basePath = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (basePath) {
    for (const candidate of [basePath, `${basePath}.ts`, `${basePath}.tsx`, resolvePath(basePath, "index.ts")]) {
      if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
