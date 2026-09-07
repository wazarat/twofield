import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Lets Node run scripts that import app modules through the "@/" alias
// and extensionless relative paths, the way Next.js resolves them.
const src = resolvePath(dirname(fileURLToPath(import.meta.url)), "../src") + "/";

function file(path) {
  for (const candidate of [path, `${path}.ts`, `${path}/index.ts`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hit = file(src + specifier.slice(2));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const path = fileURLToPath(new URL(specifier, context.parentURL));
    if (!/\.[a-z]+$/.test(path)) {
      const hit = file(path);
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
