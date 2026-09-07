import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { claimUsername, getUser, publicUser } from "@/lib/users";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = await getUser(auth.userId);
  return NextResponse.json({ user: user ? publicUser(user) : null });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { username?: unknown };
  try {
    const user = await claimUsername(auth.userId, body.username);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Could not save the username";
    console.error("username claim failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
