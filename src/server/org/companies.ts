// Empresas — regra 11.33 (quem cria), 11.20 (slug) e 7.5 (rs_fn_cria_empresa). Sem porta de API
// nem MCP: criar empresa é administração da instância (lista "sem porta" da 13.2).
import "server-only";
import type { z } from "zod";
import { slugProblem, type criarEmpresaSchema } from "@/lib/schemas/org";
import type { Papel } from "@/lib/limits";
import { canCreateCompany } from "@/server/auth/allowlist";
import { db } from "@/server/db/client";
import type { Usuario } from "@/server/db/users";
import { DomainError } from "@/server/http";

export type EmpresaDoUsuario = { slug: string; nome: string; papel: Papel };

// Empresas em que o usuário é membro ativo (consentimento do conector, 6.4). Recebe: id do usuário.
export async function listCompaniesForUser(usuarioId: string): Promise<EmpresaDoUsuario[]> {
  const { data, error } = await db()
    .from("rs_membros")
    .select("papel, rs_empresas!inner(slug, nome, excluida_em, suspensa_em)")
    .eq("usuario_id", usuarioId)
    .is("removido_em", null)
    .is("rs_empresas.excluida_em", null)
    .is("rs_empresas.suspensa_em", null);
  if (error) throw error;
  return (data ?? [])
    .map((m) => ({ slug: m.rs_empresas.slug, nome: m.rs_empresas.nome, papel: m.papel }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// O slug está livre? Recebe: slug já normalizado. Devolve: null se livre, ou o código do problema.
export async function slugStatus(slug: string): Promise<"slug_invalido" | "slug_em_uso" | null> {
  const problem = slugProblem(slug);
  if (problem) return problem;
  const { count, error } = await db().from("rs_empresas").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (error) throw error;
  return count ? "slug_em_uso" : null;
}

// Cria a empresa (8.1): confere a lista CRIACAO_EMPRESA_EMAILS (11.33) e o slug (11.20), depois
// rs_fn_cria_empresa cria empresa, administrador e pessoa, com o evento, numa transação.
// Recebe: o usuário logado e os dados validados. Devolve: id e slug.
export async function createCompany(usuario: Usuario, input: z.infer<typeof criarEmpresaSchema>) {
  if (!canCreateCompany(usuario.email)) throw new DomainError("sem_permissao_criar_empresa", 403);
  const problem = slugProblem(input.slug);
  if (problem) throw new DomainError(problem, problem === "slug_em_uso" ? 409 : 422);
  const { data, error } = await db().rpc("rs_fn_cria_empresa", {
    p_usuario: usuario.id,
    p_slug: input.slug,
    p_nome: input.nome,
    p_email_contato: input.email_contato,
  });
  if (error) {
    // Corrida entre duas criações com o mesmo slug: o índice único decide.
    if (error.code === "23505") throw new DomainError("slug_em_uso", 409);
    throw error;
  }
  return { id: data as string, slug: input.slug };
}
