// GET /api/auth/google/callback — retorno do Google (seção 6.1).
// 1) confere o state; 2) troca o código (PKCE) e valida o id_token com email_verified = true;
// 3) proteções: e-mail bloqueado não grava nada; 4) rs_fn_entra_usuario cria ou atualiza o usuário,
// recusa suspenso e e-mail de outro usuário, e aceita os convites pendentes do e-mail (11.24);
// 5) abre a sessão e volta para a rota pedida. Erros voltam para /entrar?erro=…
// Nunca registra e-mail nem token em log (seção 20.2).
import { NextResponse, type NextRequest } from "next/server";
import type { LoginErrorCode } from "@/lib/copy";
import { isEmailBlocked } from "@/server/auth/allowlist";
import { exchangeCode, verifyIdToken } from "@/server/auth/google";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, decodeOAuthCookie } from "@/server/auth/oauth-state";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { enterUser } from "@/server/db/users";
import { getInviteByToken } from "@/server/org/members";
import { errorCode } from "@/server/error-code";

// Redireciona para /entrar com o código de erro e apaga o cookie do OAuth.
function fail(req: NextRequest, code: LoginErrorCode) {
  const res = NextResponse.redirect(new URL(`/entrar?erro=${code}`, req.url), 302);
  res.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
  return res;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const saved = decodeOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  if (!code || !state || !saved || state !== saved.state) return fail(req, "falha");

  try {
    const identity = await verifyIdToken(await exchangeCode(code, saved.verifier));
    if (isEmailBlocked(identity.email)) return fail(req, "sem_acesso");
    let entered;
    try {
      entered = await enterUser(identity);
    } catch (e) {
      const c = errorCode(e);
      if (c === "usuario_suspenso") return fail(req, "suspenso");
      if (c === "email_em_uso") return fail(req, "email_em_uso");
      throw e;
    }
    // Volta do convite (6.1): se o login já aceitou esse convite, o token deixou de existir e a
    // tela diria "Convite vencido"; nesse caso vai para /painel, que leva à empresa.
    let volta = saved.volta;
    if (volta.startsWith("/convite/") && !(await getInviteByToken(volta.slice("/convite/".length)))) volta = "/painel";
    const res = NextResponse.redirect(new URL(volta, req.url), 302);
    res.cookies.set(SESSION_COOKIE, await signSession(entered.usuarioId), sessionCookieOptions());
    res.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
    return res;
  } catch (e) {
    console.error("auth_callback_falhou", errorCode(e));
    return fail(req, "falha");
  }
}
