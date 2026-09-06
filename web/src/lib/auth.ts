import { verifyAccessToken } from "@privy-io/node";
import { createRemoteJWKSet } from "jose";
import { NextResponse } from "next/server";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const jwks = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));

export type AuthResult = { userId: string; response?: undefined } | { userId?: undefined; response: NextResponse };

// Reads the bearer token from the request and returns the Privy user DID, or a 401 response.
export async function requireUser(request: Request): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  try {
    const claims = await verifyAccessToken({ access_token: token, app_id: appId, verification_key: jwks });
    return { userId: claims.user_id };
  } catch {
    return { response: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }) };
  }
}
