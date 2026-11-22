// Trilha para integrações (8.8; 13.2 GET /eventos, 11.6, 11.32): eventos da empresa depois de um
// id, em ordem crescente, para sincronização incremental. `dados` já não tem dado pessoal (11.6).
// No alcance: evento de vaga só se a vaga estiver no alcance; sem vaga, só administrador (a chave de
// API é da empresa e vê tudo).
import "server-only";
import { z } from "zod";
import type { ContextoCredencial } from "@/server/auth/credential";
import { db } from "@/server/db/client";
import { alcanceJson } from "@/server/recruiting/jobs";

export const EventoV1 = z.object({
  id: z.number().int(),
  tipo: z.string(),
  criado_em: z.string(),
  vaga_id: z.uuid().nullable(),
  candidatura_id: z.uuid().nullable(),
  ator: z.object({
    tipo: z.enum(["membro", "candidato", "sistema", "api", "agente"]),
    origem: z.string(),
    membro_id: z.uuid().nullable(),
    credencial_id: z.uuid().nullable(),
    autorizado_por_membro_id: z.uuid().nullable(),
  }),
  dados: z.record(z.string(), z.unknown()),
});
export const ListaEventos = z.object({ itens: z.array(EventoV1), proximo_desde: z.number().int().nullable() });

// Lista os eventos depois de `desde`. Recebe: contexto, desde (0 = do começo) e limite. Devolve:
// os itens e o próximo `desde` (null quando acabou).
export async function listEvents(ctx: ContextoCredencial, desde: number, limite: number): Promise<z.infer<typeof ListaEventos>> {
  const admin = !ctx.membro || ctx.membro.membro.papel === "administrador";
  const { data, error } = await db().rpc("rs_fn_lista_eventos", {
    p_empresa: ctx.empresa.id, p_alcance: alcanceJson(ctx.alcance) as never, p_admin: admin, p_desde: desde, p_limite: limite + 1,
  });
  if (error) throw error;
  const linhas = (data ?? []) as { id: number; tipo: string; criado_em: string; vaga_id: string | null; candidatura_id: string | null; ator_tipo: z.infer<typeof EventoV1>["ator"]["tipo"];
    origem: string; membro_id: string | null; credencial_id: string | null; autorizado_por_membro_id: string | null; dados: Record<string, unknown> }[];
  const itens = linhas.slice(0, limite).map((e) => ({
    id: Number(e.id), tipo: e.tipo, criado_em: e.criado_em, vaga_id: e.vaga_id, candidatura_id: e.candidatura_id,
    ator: { tipo: e.ator_tipo, origem: e.origem, membro_id: e.membro_id, credencial_id: e.credencial_id, autorizado_por_membro_id: e.autorizado_por_membro_id },
    dados: e.dados ?? {},
  }));
  return { itens, proximo_desde: linhas.length > limite ? itens[itens.length - 1].id : null };
}
