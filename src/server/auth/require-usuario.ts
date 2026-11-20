// Guardiões do usuário logado na web (seções 6.1, 6.4 e 20.3): consentimento do conector
// (/oauth/autorizar e as rotas /oauth/*), convite (/convite e /api/convite/*).
import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getUserById, type Usuario } from "@/server/db/users";
import { jsonError, originAllowed } from "@/server/http";
import { SESSION_COOKIE, verifySession } from "./session";

// Guarda de rota de API. Recebe: a requisição e se exige o aceite dos Termos.
// Devolve: o usuário, ou uma Response 401/403 pronta para retornar.
export async function requireUsuario(req: NextRequest, opts: { termos?: boolean } = { termos: true }): Promise<Usuario | Response> {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return jsonError("nao_autenticado", 401);
  const usuario = await getUserById(session.usuarioId);
  if (!usuario) return jsonError("nao_autenticado", 401);
  if (opts.termos !== false && !usuario.termos_aceitos_em) return jsonError("sem_permissao", 403);
  return usuario;
}

// Lê o usuário da sessão em Server Components (dentro de <Suspense>, Cache Components).
// Devolve: o usuário ou null (a página volta para /entrar).
export async function getCurrentUser(): Promise<Usuario | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return getUserById(session.usuarioId);
}
