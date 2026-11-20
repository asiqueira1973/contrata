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

// Formato que as funções SQL esperam em p_ator (rs_fn_registra_evento). A origem vai junto e
// vence a da função (formulário, MCP, API ou web). Recebe: o ator.
export function atorJson(ator: Ator) {
  return {
    tipo: ator.tipo,
    origem: ator.origem,
    ...(ator.membroId ? { membro_id: ator.membroId } : {}),
    ...(ator.credencialId ? { credencial_id: ator.credencialId } : {}),
    ...(ator.autorizadoPorMembroId ? { autorizado_por_membro_id: ator.autorizadoPorMembroId } : {}),
  };
}

// Ator de um membro agindo nas páginas de entrada (consentimento e convite). Recebe: id do membro.
export function atorDaWeb(membroId: string): Ator {
  return { tipo: "membro", membroId, origem: "web" };
}

// Ator de um membro que clicou em Salvar num formulário do chat (11.34): a pessoa grava, então o
// ator é o membro, com a credencial do conector registrada. Recebe: o ator do token.
export function atorDoFormulario(ator: Ator): Ator {
  return { tipo: "membro", membroId: ator.membroId, credencialId: ator.credencialId, origem: "formulario" };
}
