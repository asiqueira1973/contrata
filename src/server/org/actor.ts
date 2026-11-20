// Ator explícito (seção 18): toda função de domínio que escreve recebe quem agiu e repassa ao
// evento da trilha (11.6). Não existe valor padrão para o ator.
import "server-only";
import type { Database } from "@/server/db/types";

export type Origem = Database["public"]["Enums"]["rs_origem_evento"];
export type Ator = {
  tipo: Database["public"]["Enums"]["rs_tipo_ator"];
  membroId?: string;
  credencialId?: string;
  autorizadoPorMembroId?: string;
  origem: Origem;
};

// Formato que as funções SQL esperam em p_ator (rs_fn_registra_evento). Recebe: o ator.
export function atorJson(ator: Ator) {
  return {
    tipo: ator.tipo,
    ...(ator.membroId ? { membro_id: ator.membroId } : {}),
    ...(ator.credencialId ? { credencial_id: ator.credencialId } : {}),
    ...(ator.autorizadoPorMembroId ? { autorizado_por_membro_id: ator.autorizadoPorMembroId } : {}),
  };
}

// Ator de um membro agindo pelo painel. Recebe: id do membro.
export function atorDoPainel(membroId: string): Ator {
  return { tipo: "membro", membroId, origem: "painel" };
}
