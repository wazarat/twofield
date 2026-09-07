import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export function platformOwnerId() {
  return process.env.NEXT_PUBLIC_PLATFORM_OWNER_ID ?? "";
}

// The platform owner runs the human review queue.
export async function requirePlatformOwner(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth;
  if (!platformOwnerId() || auth.userId !== platformOwnerId()) {
    return { response: NextResponse.json({ error: "Only the platform owner can review work" }, { status: 403 }) };
  }
  return auth;
}
