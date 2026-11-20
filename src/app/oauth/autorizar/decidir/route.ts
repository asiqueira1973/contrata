// POST /oauth/autorizar/decidir — a decisão do consentimento (6.4). Exige sessão, Termos aceitos e
// Origin do site (requireUsuario). Confere o pedido de novo (o formulário pode ter sido mexido),
// confere que o usuário é membro ativo da empresa escolhida e recorta os escopos pelo papel
// (11.16; leitura sempre). "Permitir" grava o código (10 min, PKCE) e volta com ?code&state;
// "Cancelar" volta com ?error=access_denied&state. Pedido inválido → 400, sem redirecionar.
import { NextResponse, type NextRequest } from "next/server";
import { ESCOPOS, type Escopo } from "@/lib/limits";
import { expandScopes, scopesForRole } from "@/server/auth/credential";
import { requireUsuario } from "@/server/auth/require-usuario";
import { db } from "@/server/db/client";
import { checkAuthorizeParams, withParams } from "@/server/oauth/authorize";
import { createAuthorizationCode } from "@/server/oauth/server";

export async function POST(req: NextRequest) {
  const usuario = await requireUsuario(req);
  if (usuario instanceof Response) return usuario;
  const form = await req.formData().catch(() => null);
  const get = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const p = Object.fromEntries(["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state"].map((k) => [k, get(k)]));
  const check = await checkAuthorizeParams(p);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  const { client, redirectUri, codeChallenge, state } = check.req;
  const extra: Record<string, string> = state ? { state } : {};
  if (get("decisao") !== "permitir") return NextResponse.redirect(withParams(redirectUri, { error: "access_denied", ...extra }), 303);

  // Vínculo ativo com a empresa escolhida (o slug vem do formulário: confere no banco).
  const { data: m } = await db()
    .from("rs_membros")
    .select("id, papel, rs_empresas!inner(id, slug, excluida_em, suspensa_em)")
    .eq("usuario_id", usuario.id)
    .eq("rs_empresas.slug", get("empresa") ?? "")
    .is("rs_empresas.excluida_em", null)
    .is("rs_empresas.suspensa_em", null)
    .is("removido_em", null)
    .maybeSingle();
  if (!m) return Response.json({ error: "invalid_request" }, { status: 400 });
  const pedidos = (form?.getAll("escopo") ?? []).filter((v): v is Escopo => typeof v === "string" && (ESCOPOS as readonly string[]).includes(v));
  const permitidos = new Set(scopesForRole(m.papel));
  const escopos = expandScopes(["leitura", ...pedidos]).filter((e) => permitidos.has(e));
  const code = await createAuthorizationCode({ client, empresaId: m.rs_empresas.id, membroId: m.id, escopos, redirectUri, codeChallenge });
  return NextResponse.redirect(withParams(redirectUri, { code, ...extra }), 303);
}
