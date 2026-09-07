// Username rules shared by the browser form and the API. No server imports here.
export const usernameRules = {
  min: 3,
  max: 24,
  // Lowercase letters and digits, single hyphens between them, none at the ends.
  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
};

export const reservedUsernames = ["admin", "twofield", "platform", "api", "review", "agents", "sellers", "jobs", "history", "me"];

export function validateUsername(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value.length < usernameRules.min || value.length > usernameRules.max) {
    return { ok: false, error: `Usernames are ${usernameRules.min} to ${usernameRules.max} characters` };
  }
  if (!usernameRules.pattern.test(value)) {
    return { ok: false, error: "Use lowercase letters, digits and single hyphens, not at the ends" };
  }
  if (reservedUsernames.includes(value)) return { ok: false, error: "That username is reserved" };
  return { ok: true, value };
}
