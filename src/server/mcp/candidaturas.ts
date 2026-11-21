// Peças das ferramentas de candidatura (8.5): achar a candidatura que a pessoa citou ("a Ana")
// e a etapa ("entrevista com RH") dentro do alcance (11.32), sem chutar quando há mais de uma.
import "server-only";
import { z } from "zod";
import { LISTA_MAX } from "@/lib/limits";
import { db } from "@/server/db/client";
import { DomainError } from "@/server/http";
import { getJob, type ContextoVagas, type VagaDetalhe } from "@/server/recruiting/jobs";
import { listApplications } from "@/server/recruiting/pipeline";
import { acharPorNome } from "./forms/comum";
import { acharVaga } from "./vagas";

const ehId = (s: string) => z.uuid().safeParse(s).success;

// Acha a candidatura pelo id ou pelo nome da pessoa (igual, ou uma só que contenha), entre as
// do alcance, opcionalmente numa vaga. Recebe: contexto, texto e a vaga (título ou id).
// Devolve: o id. Lança candidatura_nao_encontrada quando não há uma só.
export async function acharCandidatura(ctx: ContextoVagas, texto: unknown, vaga?: unknown): Promise<string> {
  if (typeof texto !== "string" || !texto.trim()) throw new DomainError("candidatura_nao_encontrada", 404);
  if (ehId(texto.trim())) return texto.trim();
  let vagaId: string | undefined;
  if (typeof vaga === "string" && vaga.trim()) {
    const v = await acharVaga(ctx, vaga);
    if (!v) throw new DomainError("vaga_nao_encontrada", 404);
    vagaId = v.id;
  }
  const { itens } = await listApplications(ctx, { situacao: "todas", ...(vagaId ? { vaga_id: vagaId } : {}), q: undefined }, { inicio: 0, limite: LISTA_MAX });
  const achada = acharPorNome(itens, texto);
  if (!achada) throw new DomainError("candidatura_nao_encontrada", 404);
  return achada.id;
}

// A vaga de uma candidatura (sem dado do candidato), conferindo o alcance pela vaga.
export async function vagaDaCandidatura(ctx: ContextoVagas, candidaturaId: string): Promise<VagaDetalhe> {
  const { data, error } = await db().from("rs_candidaturas").select("vaga_id").eq("empresa_id", ctx.empresa.id).eq("id", candidaturaId)
    .not("recebida_em", "is", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new DomainError("candidatura_nao_encontrada", 404);
  try {
    return await getJob(ctx, data.vaga_id);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) throw new DomainError("candidatura_nao_encontrada", 404);
    throw e;
  }
}

// Acha a etapa de uma vaga pelo id ou pelo nome. Lança etapa_nao_encontrada.
export function acharEtapa(vaga: VagaDetalhe, texto: unknown): { id: string; nome: string } {
  if (typeof texto === "string" && ehId(texto.trim())) {
    const e = vaga.etapas.find((x) => x.id === texto.trim());
    if (e) return e;
  }
  const e = acharPorNome(vaga.etapas, texto);
  if (!e) throw new DomainError("etapa_nao_encontrada", 404);
  return e;
}
