// GET /api/auth/google — início do login com Google (seção 6.1).
// Gera state e PKCE, guarda os dois e a rota de volta (?volta=, saneada) num cookie curto
// HttpOnly e redireciona ao Google.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, createPkce } from "@/server/auth/google";
import { OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE_S, OAUTH_COOKIE_PATH, encodeOAuthCookie, safeReturnPath } from "@/server/auth/oauth-state";

export async function GET(req: NextRequest) {
  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkce();
  const volta = safeReturnPath(req.nextUrl.searchParams.get("volta"));
  const res = NextResponse.redirect(buildAuthUrl(state, challenge), 302);
  res.cookies.set(OAUTH_COOKIE, encodeOAuthCookie({ state, verifier, volta }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE_S,
  });
  return res;
}
