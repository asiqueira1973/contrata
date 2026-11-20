// Guardião do painel da empresa — seção 5 (requireMembro na primeira linha de toda rota
// /api/painel/{e}/…) e 20.3 (o vínculo é relido a cada requisição: membro removido ou rebaixado
// perde o acesso na requisição seguinte; não há papel em cookie).
// A empresa vem da URL, nunca da sessão (6.1). Empresa inexistente, excluída, suspensa ou de que
// o usuário não é membro dão o mesmo 404, para não revelar que a empresa existe.
import "server-only";
import type { NextRequest } from "next/server";
import { PAPEIS, type Papel } from "@/lib/limits";
import { db } from "@/server/db/client";
import type { Usuario } from "@/server/db/users";
import { jsonError } from "@/server/http";
import { atorDoPainel, type Ator } from "@/server/org/actor";
import { computeScope, type Alcance } from "@/server/org/scope";
import { getCurrentUser, requireUsuario } from "./require-usuario";

export type Empresa = { id: string; slug: string; nome: string; email_contato: string };
export type Membro = { id: string; papel: Papel; todas_areas: boolean };
export type ContextoMembro = { usuario: Usuario; membro: Membro; empresa: Empresa; alcance: Alcance; ator: Ator };

// Lê o vínculo do usuário com a empresa do slug e calcula o alcance. Devolve null se não houver
// vínculo ativo. Recebe: usuário e slug.
async function loadMembership(usuario: Usuario, empresaSlug: string): Promise<Omit<ContextoMembro, "usuario"> | null> {
  const { data: empresa, error } = await db()
    .from("rs_empresas")
    .select("id, slug, nome, email_contato")
    .eq("slug", empresaSlug)
    .is("excluida_em", null)
    .is("suspensa_em", null)
    .maybeSingle();
  if (error) throw error;
  if (!empresa) return null;
  const { data: membro, error: e2 } = await db()
    .from("rs_membros")
    .select("id, papel, todas_areas, rs_membro_areas(area_id)")
    .eq("empresa_id", empresa.id)
    .eq("usuario_id", usuario.id)
    .is("removido_em", null)
    .maybeSingle();
  if (e2) throw e2;
  if (!membro) return null;
  const m: Membro = { id: membro.id, papel: membro.papel, todas_areas: membro.todas_areas };
  const areaIds = (membro.rs_membro_areas ?? []).map((a) => a.area_id);
  return { empresa, membro: m, alcance: computeScope(m, areaIds), ator: atorDoPainel(m.id) };
}

// Diz se o papel alcança o mínimo exigido (seção 5).
export function papelAtende(papel: Papel, minimo: Papel): boolean {
  return PAPEIS.indexOf(papel) >= PAPEIS.indexOf(minimo);
}

// Guarda de rota de API do painel. Recebe: a requisição, o slug da URL e o papel mínimo.
// Devolve: o contexto, ou uma Response 401/403/404 pronta para retornar.
export async function requireMembro(req: NextRequest, empresaSlug: string, papelMinimo: Papel): Promise<ContextoMembro | Response> {
  const usuario = await requireUsuario(req);
  if (usuario instanceof Response) return usuario;
  const ctx = await loadMembership(usuario, empresaSlug);
  if (!ctx) return jsonError("nao_encontrado", 404);
  if (!papelAtende(ctx.membro.papel, papelMinimo)) return jsonError("sem_permissao", 403);
  return { usuario, ...ctx };
}

// Versão para Server Components (dentro de <Suspense>). Devolve: o contexto, "sem_sessao" (vai
// para /entrar) ou "sem_acesso" (404 na página).
export async function getMemberContext(empresaSlug: string): Promise<ContextoMembro | "sem_sessao" | "sem_acesso"> {
  const usuario = await getCurrentUser();
  if (!usuario) return "sem_sessao";
  const ctx = await loadMembership(usuario, empresaSlug);
  return ctx ? { usuario, ...ctx } : "sem_acesso";
}
