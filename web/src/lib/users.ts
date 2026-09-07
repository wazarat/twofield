import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { validateUsername } from "@/lib/username";

export class UserError extends AppError {}

export async function getUser(userId: string): Promise<User | null> {
  const [row] = await db().select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

// Sets the username once. Usernames are not edited in this block.
export async function claimUsername(userId: string, raw: unknown) {
  const parsed = validateUsername(raw);
  if (!parsed.ok) throw new UserError(parsed.error, 400);
  const existing = await getUser(userId);
  if (existing) throw new UserError("This account already has a username", 409);
  const [taken] = await db().select({ id: users.id }).from(users).where(eq(users.username, parsed.value)).limit(1);
  if (taken) throw new UserError("That username is taken", 409);
  try {
    const [row] = await db().insert(users).values({ id: userId, username: parsed.value }).returning();
    return row;
  } catch (err) {
    // Two requests can race past the checks above, the unique index settles it.
    if ((err as { code?: string }).code === "23505") throw new UserError("That username is taken", 409);
    throw err;
  }
}

export function publicUser(user: User) {
  return { id: user.id, username: user.username };
}
