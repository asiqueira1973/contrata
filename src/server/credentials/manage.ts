// Credenciais da empresa (6.3, 11.15; seção 5): conexões do conector e chaves de API.
// O membro vê e revoga as próprias conexões; o administrador vê e revoga todas e cria chaves.
// Toda consulta filtra por empresa_id (a service role ignora RLS, 6.5).
import "server-only";
import { CHAVES_API_ATIVAS_MAX, type Escopo } from "@/lib/limits";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { db } from "@/server/db/client";
import { DomainError } from "@/server/http";
import { atorJson } from "@/server/org/actor";
import { generateCredential } from "./keys";
import { quemDoAtor, track } from "@/server/analytics/client";

export type CredencialListada = {
  id: string;
  tipo: "api" | "mcp";
  nome: string;
  prefixo: string;
  escopos: Escopo[];
  membro: { id: string; nome: string | null } | null;
  ultimo_uso_em: string | null;
  criado_em: string;
};

// Credenciais ativas que o membro pode ver: as próprias conexões; o administrador vê todas.
export async function listCredentials(ctx: ContextoMembro): Promise<CredencialListada[]> {
  let q = db()
    .from("rs_credenciais")
    .select("id, tipo, nome, prefixo, escopos, ultimo_uso_em, criado_em, membro:membro_id(id, rs_usuarios(nome))")
    .eq("empresa_id", ctx.empresa.id)
    .is("revogada_em", null)
    .order("criado_em", { ascending: false });
  if (ctx.membro.papel !== "administrador") q = q.eq("tipo", "mcp").eq("membro_id", ctx.membro.id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    tipo: c.tipo,
    nome: c.nome,
    prefixo: c.prefixo,
    escopos: c.escopos,
    membro: c.membro ? { id: c.membro.id, nome: c.membro.rs_usuarios?.nome ?? null } : null,
    ultimo_uso_em: c.ultimo_uso_em,
    criado_em: c.criado_em,
  }));
}

// Revoga uma credencial que o membro pode ver (as próprias conexões; administrador: todas).
export async function revokeCredential(ctx: ContextoMembro, id: string): Promise<void> {
  const visiveis = await listCredentials(ctx);
  if (!visiveis.some((c) => c.id === id)) throw new DomainError("nao_encontrado", 404);
  const { error } = await db().rpc("rs_fn_revoga_credencial", { p_credencial: id, p_empresa: ctx.empresa.id, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
}

// Cria uma chave de API (só administrador). Devolve o valor em claro, que aparece uma vez.
export async function createApiKey(ctx: ContextoMembro, nome: string, escopos: Escopo[]): Promise<{ id: string; valor: string }> {
  if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
  const k = generateCredential("api");
  const { data, error } = await db().rpc("rs_fn_cria_chave_api", {
    p_empresa: ctx.empresa.id,
    p_nome: nome,
    p_prefixo: k.prefixo,
    p_valor_hash: k.hash,
    p_escopos: escopos,
    p_max_ativas: CHAVES_API_ATIVAS_MAX,
    p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  track("vaga_aberta_chave_criada", {
    quem: quemDoAtor(ctx.ator, ctx.empresa.id), chave: data as string,
    propriedades: { escopos },
  });
  return { id: data as string, valor: k.valor };
}
