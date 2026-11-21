// Peças das rotas de candidatura da API v1 (8.5; 13.2): filtros da lista e a forma das respostas.
// A chave de API vê todas as vagas (alcance todas, 11.16) e todas as avaliações (11.9).
import "server-only";
import { z } from "zod";
import { CamposInvalidos } from "@/server/http";
import type { CandidaturaDetalhe, FiltrosCandidaturas } from "@/server/recruiting/pipeline";
import { CandidaturaV1 } from "./v1";

const filtrosSchema = z.object({
  vaga_id: z.uuid().optional(),
  etapa_id: z.uuid().optional(),
  situacao: z.enum(["ativa", "reprovada", "desistiu", "contratada", "encerrada_vaga", "todas"]).optional(),
  sinalizada: z.enum(["true", "false"]).optional(),
  parada_desde: z.iso.datetime({ offset: true }).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  atualizada_desde: z.iso.datetime({ offset: true }).optional(),
  ordem: z.enum(["chegada", "movimentacao"]).optional(),
});

// Lê os filtros da query string. Filtro inválido volta campo a campo (400).
export function filtrosDaQuery(sp: URLSearchParams): FiltrosCandidaturas {
  const bruto = Object.fromEntries([...sp].filter(([k]) => k in filtrosSchema.shape));
  const f = filtrosSchema.safeParse(bruto);
  if (!f.success) throw new CamposInvalidos(f.error.issues.map((i) => ({ campo: String(i.path[0]), codigo: "campo_invalido" })));
  const { sinalizada, ...resto } = f.data;
  return { ...resto, ...(sinalizada ? { sinalizada: sinalizada === "true" } : {}) };
}

// Candidatura no formato da API (CandidaturaV1). A chave vê tudo: notas nunca vêm ocultas.
export function candidaturaV1(c: CandidaturaDetalhe) {
  return CandidaturaV1.parse({ ...c, notas: c.notas ?? [] });
}
