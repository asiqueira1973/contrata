// Áreas da empresa — seção 7.3, 7.4 e regra 11.32. Sem porta de escrita na API nem no MCP (13.2);
// a leitura (listar_areas, GET /areas) entra no 8.2 sobre listAreas.
import "server-only";
import type { z } from "zod";
import type { areaSchema } from "@/lib/schemas/org";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { db } from "@/server/db/client";
import { atorJson } from "./actor";

export type AreaListada = {
  id: string;
  nome: string;
  responsavel: { id: string; nome: string } | null;
  vagas_abertas: number;
  recrutadores: number;
};

// Áreas ativas com responsável, vagas abertas (publicada ou pausada) e recrutadores limitados a
// elas (tela Áreas, seção 10). Recebe: id da empresa.
export async function listAreas(empresaId: string): Promise<AreaListada[]> {
  const { data, error } = await db()
    .from("rs_areas")
    .select("id, nome, responsavel:responsavel_pessoa_id(id, nome), rs_vagas(status), rs_membro_areas(rs_membros(removido_em))")
    .eq("empresa_id", empresaId)
    .is("arquivada_em", null)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    responsavel: a.responsavel ?? null,
    vagas_abertas: (a.rs_vagas ?? []).filter((v) => v.status === "publicada" || v.status === "pausada").length,
    recrutadores: (a.rs_membro_areas ?? []).filter((m) => m.rs_membros && !m.rs_membros.removido_em).length,
  }));
}

// Cria (id nulo) ou edita uma área; o banco confere responsável e nome repetido. Devolve: id.
export async function saveArea(ctx: ContextoMembro, id: string | null, input: z.infer<typeof areaSchema>): Promise<string> {
  const { data, error } = await db().rpc("rs_fn_salva_area", {
    p_empresa: ctx.empresa.id,
    p_id: id as string,
    p_nome: input.nome,
    p_responsavel: input.responsavel_pessoa_id as string,
    p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  return data as string;
}

// Arquiva uma área (7.4); o banco recusa com area_em_uso quando não pode.
export async function archiveArea(ctx: ContextoMembro, id: string): Promise<void> {
  const { error } = await db().rpc("rs_fn_arquiva_area", { p_area: id, p_empresa: ctx.empresa.id, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
}
