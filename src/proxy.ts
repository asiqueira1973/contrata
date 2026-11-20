// Proxy do Next 16 (antigo middleware) — seção 6.1.
// 1) Painel: checagem otimista; /painel sem cookie de sessão válido vai para /entrar?volta=… e o
//    cookie com mais de 7 dias é renovado. A autorização de verdade é feita pelos guardiões
//    (requireUsuario, requireMembro), que releem o vínculo a cada requisição.
// 2) "/": com sessão válida vai para o painel; sem, para /entrar (até a página inicial do 8.12).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, shouldRenew, signSession, verifySession } from "@/server/auth/session";

// Painel: exige cookie de sessão válido e renova se tiver mais de 7 dias.
async function guardPanel(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const login = new URL("/entrar", request.url);
    login.searchParams.set("volta", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  const res = NextResponse.next();
  if (shouldRenew(session)) res.cookies.set(SESSION_COOKIE, await signSession(session.usuarioId), sessionCookieOptions());
  return res;
}

// Decide o que fazer com cada requisição que passa pelo matcher.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/painel" || path.startsWith("/painel/")) return guardPanel(request);
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.redirect(new URL(session ? "/painel" : "/entrar", request.url));
}

export const config = {
  matcher: ["/", "/painel", "/painel/:path*"],
};
