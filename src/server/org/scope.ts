// Alcance do membro — seção 5 e regra 11.32.
// Administrador e recrutador com todas as áreas: todas as vagas. Recrutador limitado: só vagas das
// áreas dele (as "Sem área" ficam fora). Avaliador: só as vagas em que está na equipe.
// O alcance é calculado a cada requisição pelo guardião (o vínculo é relido, 20.3) e recebido por
// toda função de domínio que lê vagas e candidaturas (seção 18).
import "server-only";
import { db } from "@/server/db/client";
import type { Papel } from "@/lib/limits";

export type Alcance =
  | { tipo: "todas" }
  | { tipo: "areas"; areaIds: string[] }
  | { tipo: "equipe"; membroId: string };

// Calcula o alcance de um membro. Recebe: id, papel, todas_areas e as áreas de rs_membro_areas.
export function computeScope(membro: { id: string; papel: Papel; todas_areas: boolean }, areaIds: string[]): Alcance {
  if (membro.papel === "administrador") return { tipo: "todas" };
  if (membro.papel === "recrutador") return membro.todas_areas ? { tipo: "todas" } : { tipo: "areas", areaIds };
  return { tipo: "equipe", membroId: membro.id };
}

export type VagaNoAlcance = { id: string; titulo: string; area_id: string | null; status: string };

// Lista as vagas da empresa visíveis no alcance (11.32). Sempre filtra por empresa_id primeiro
// (a service role ignora RLS, 6.5). Recebe: empresa e alcance. Devolve: as vagas, mais novas antes.
// O épico 8.3 acrescenta filtros e paginação sobre esta mesma função.
export async function listJobsInScope(empresaId: string, alcance: Alcance): Promise<VagaNoAlcance[]> {
  let query = db().from("rs_vagas").select("id, titulo, area_id, status").eq("empresa_id", empresaId);
  if (alcance.tipo === "areas") {
    if (!alcance.areaIds.length) return [];
    query = query.in("area_id", alcance.areaIds);
  } else if (alcance.tipo === "equipe") {
    const { data: equipe, error } = await db().from("rs_vaga_equipe").select("vaga_id").eq("membro_id", alcance.membroId);
    if (error) throw error;
    const ids = (equipe ?? []).map((e) => e.vaga_id);
    if (!ids.length) return [];
    query = query.in("id", ids);
  }
  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
