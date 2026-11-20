// Proxy do Next 16 (antigo middleware) — seção 6.1. Desde a v0.4 não há painel: a sessão web só
// serve às páginas de entrada (consentimento do conector e convite). Aqui ela é renovada quando
// passa de 7 dias; a autorização de verdade é do requireUsuario.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, shouldRenew, signSession, verifySession } from "@/server/auth/session";

export async function proxy(request: NextRequest) {
  const res = NextResponse.next();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session && shouldRenew(session)) res.cookies.set(SESSION_COOKIE, await signSession(session.usuarioId), sessionCookieOptions());
  return res;
}

export const config = {
  matcher: ["/oauth/autorizar", "/convite/:path*"],
};
