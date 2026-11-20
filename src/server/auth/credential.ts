// Guardião das portas de máquina (6.3, 11.16): API v1 e /mcp.
// Bearer rsk_… (chave da empresa) ou rsm_… (token do conector, de um membro numa empresa) →
// SHA-256 → rs_credenciais sem revogação → empresa ativa → para o conector, membro ativo, relido a
// cada chamada (membro removido ou rebaixado perde o poder na hora, 20.3) → escopo efetivo.
// Falha de credencial: 401 {codigo: "credencial_invalida"}; falta de escopo: 403
// {codigo: "escopo_insuficiente", escopo}. Nunca diz qual parte falhou.
import "server-only";
import type { NextRequest } from "next/server";
import { ULTIMO_USO_INTERVALO_S, type Escopo, type Papel } from "@/lib/limits";
import { CREDENCIAL_FORMATO } from "@/server/credentials/keys";
import { db } from "@/server/db/client";
import type { Usuario } from "@/server/db/users";
import { jsonError } from "@/server/http";
import type { Ator } from "@/server/org/actor";
import { computeScope, type Alcance } from "@/server/org/scope";
import { hashToken } from "./tokens";
import type { ContextoMembro, Empresa, Membro } from "./require-membro";

export type ContextoCredencial = {
  empresa: Empresa;
  credencial: { id: string; tipo: "api" | "mcp"; nome: string };
  escopos: Escopo[];
  alcance: Alcance;
  ator: Ator;
  // Só para o token do conector: o membro que o autorizou, com o contexto do domínio do 8.1.
  membro?: ContextoMembro;
};

// Expande a hierarquia (6.3): escrita implica leitura; decisao implica as duas.
export function expandScopes(escopos: readonly string[]): Escopo[] {
  const s = new Set(escopos);
  if (s.has("decisao")) s.add("escrita");
  if (s.has("escrita")) s.add("leitura");
  return (["leitura", "escrita", "decisao"] as const).filter((e) => s.has(e));
}

// Escopos que um papel permite ao conector (11.16): avaliador só lê (e avalia por formulário,
// pelo papel, no 8.5); recrutador e administrador podem tudo.
export function scopesForRole(papel: Papel): Escopo[] {
  return papel === "avaliador" ? ["leitura"] : ["leitura", "escrita", "decisao"];
}

// Lê a credencial do cabeçalho e monta o contexto. Devolve null se inválida (sem distinguir).
export async function resolveCredential(authorization: string | null): Promise<ContextoCredencial | null> {
  const m = /^Bearer\s+(\S+)$/.exec(authorization ?? "");
  if (!m || !CREDENCIAL_FORMATO.test(m[1])) return null;
  const { data: c, error } = await db()
    .from("rs_credenciais")
    .select("id, tipo, nome, escopos, membro_id, ultimo_uso_em, rs_empresas!inner(id, slug, nome, email_contato, excluida_em, suspensa_em)")
    .eq("valor_hash", hashToken(m[1]))
    .is("revogada_em", null)
    .maybeSingle();
  if (error) throw error;
  if (!c || c.rs_empresas.excluida_em || c.rs_empresas.suspensa_em) return null;
  const empresa: Empresa = { id: c.rs_empresas.id, slug: c.rs_empresas.slug, nome: c.rs_empresas.nome, email_contato: c.rs_empresas.email_contato };
  const credencial = { id: c.id, tipo: c.tipo, nome: c.nome };

  let ctx: ContextoCredencial;
  if (c.tipo === "api") {
    ctx = { empresa, credencial, escopos: expandScopes(c.escopos), alcance: { tipo: "todas" }, ator: { tipo: "api", credencialId: c.id, origem: "api" } };
  } else {
    const { data: mb, error: e2 } = await db()
      .from("rs_membros")
      .select("id, papel, todas_areas, usuario_id, rs_membro_areas(area_id), rs_usuarios!inner(id, email, nome, foto_url, termos_aceitos_em, suspenso_em)")
      .eq("id", c.membro_id as string)
      .eq("empresa_id", empresa.id)
      .is("removido_em", null)
      .maybeSingle();
    if (e2) throw e2;
    if (!mb || mb.rs_usuarios.suspenso_em) return null;
    const membro: Membro = { id: mb.id, papel: mb.papel, todas_areas: mb.todas_areas };
    const alcance = computeScope(membro, (mb.rs_membro_areas ?? []).map((a) => a.area_id));
    const permitidos = new Set(scopesForRole(membro.papel));
    const ator: Ator = { tipo: "agente", membroId: membro.id, credencialId: c.id, origem: "mcp" };
    const u = mb.rs_usuarios;
    const usuario: Usuario = { id: u.id, email: u.email, nome: u.nome, foto_url: u.foto_url, termos_aceitos_em: u.termos_aceitos_em };
    ctx = {
      empresa,
      credencial,
      escopos: expandScopes(c.escopos).filter((e) => permitidos.has(e)),
      alcance,
      ator,
      membro: { usuario, membro, empresa, alcance, ator },
    };
  }
  // Último uso no máximo uma vez por minuto (6.3).
  if (!c.ultimo_uso_em || Date.now() - new Date(c.ultimo_uso_em).getTime() > ULTIMO_USO_INTERVALO_S * 1000) {
    await db().from("rs_credenciais").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", c.id);
  }
  return ctx;
}

// Guarda das rotas de máquina. Recebe: requisição, tipos aceitos e o escopo exigido.
// Devolve: o contexto ou a Response 401/403 pronta.
export async function requireCredencial(req: NextRequest | Request, tipos: ("api" | "mcp")[], escopo?: Escopo): Promise<ContextoCredencial | Response> {
  const ctx = await resolveCredential(req.headers.get("authorization"));
  if (!ctx || !tipos.includes(ctx.credencial.tipo)) return jsonError("credencial_invalida", 401);
  if (escopo && !ctx.escopos.includes(escopo)) return jsonError("escopo_insuficiente", 403, { escopo });
  return ctx;
}
