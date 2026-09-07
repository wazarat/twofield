// Context a buyer attaches to a job. Shared by the hire form and the API, so no server
// imports here.

export const contextLimits = {
  contextMax: 20000,
  maxFiles: 12,
  maxFileBytes: 60 * 1024,
  maxTotalBytes: 200 * 1024,
  nameMax: 120,
};

export const allowedExtensions = [
  "txt", "md", "csv", "json", "yaml", "yml", "ts", "tsx", "js", "jsx", "py", "go", "rs", "sol", "sql", "html", "css", "sh", "toml", "example",
];

export const acceptList = allowedExtensions.map((e) => `.${e}`).join(",");

export type ContextFile = { name: string; content: string };

export function fileBytes(content: string) {
  return new TextEncoder().encode(content).length;
}

export function fileExtension(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
}

export function validateContext(body: unknown): { ok: true; context: string; files: ContextFile[] } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const context = typeof b.context === "string" ? b.context.trim() : "";
  if (context.length > contextLimits.contextMax) {
    return { ok: false, error: `Pasted context must be ${contextLimits.contextMax} characters or fewer` };
  }
  const raw = Array.isArray(b.files) ? b.files : [];
  if (raw.length > contextLimits.maxFiles) return { ok: false, error: `Attach at most ${contextLimits.maxFiles} files` };

  const files: ContextFile[] = [];
  let total = 0;
  const seen = new Set<string>();
  for (const item of raw) {
    const f = (item ?? {}) as Record<string, unknown>;
    const name = typeof f.name === "string" ? f.name.split(/[\\/]/).pop()?.trim() ?? "" : "";
    const content = typeof f.content === "string" ? f.content : "";
    if (!name || name.length > contextLimits.nameMax) return { ok: false, error: "Every file needs a name under 120 characters" };
    if (!allowedExtensions.includes(fileExtension(name))) {
      return { ok: false, error: `${name} is not a text file type we accept. Use ${allowedExtensions.slice(0, 6).join(", ")} and similar` };
    }
    if (seen.has(name)) return { ok: false, error: `${name} is attached twice` };
    seen.add(name);
    const bytes = fileBytes(content);
    if (bytes === 0) return { ok: false, error: `${name} is empty` };
    if (bytes > contextLimits.maxFileBytes) {
      return { ok: false, error: `${name} is ${formatBytes(bytes)}, the limit per file is ${formatBytes(contextLimits.maxFileBytes)}` };
    }
    total += bytes;
    files.push({ name, content });
  }
  if (total > contextLimits.maxTotalBytes) {
    return { ok: false, error: `Files add up to ${formatBytes(total)}, the limit per job is ${formatBytes(contextLimits.maxTotalBytes)}` };
  }
  return { ok: true, context, files };
}

const fenceLanguage: Record<string, string> = { yml: "yaml", example: "text", txt: "text", md: "markdown", sh: "bash" };

// The block appended to the brief in the specialist prompt.
export function contextForPrompt(context: string | null, files: ContextFile[]) {
  if (!context && files.length === 0) return "";
  const parts = ["Context from the buyer."];
  if (context) parts.push(context);
  for (const f of files) {
    const ext = fileExtension(f.name);
    parts.push(`File ${f.name}\n\`\`\`${fenceLanguage[ext] ?? ext}\n${f.content}\n\`\`\``);
  }
  return parts.join("\n\n");
}
