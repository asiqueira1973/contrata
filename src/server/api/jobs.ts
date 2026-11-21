// Peças das rotas /api/v1/vagas (8.3; 13.2): corpo JSON, id da rota, conversão da vaga para o
// formato da API (nomes do banco) e a junção do PATCH com a vaga atual. A regra é a do domínio
// (src/server/recruiting/jobs.ts), com o mesmo schema da 11.1 do formulário.
import "server-only";
import { z } from "zod";
import { IDEMPOTENCIA_MAX } from "@/lib/limits";
import { CamposInvalidos, DomainError } from "@/server/http";
import type { VagaDetalhe } from "@/server/recruiting/jobs";
import { VagaV1 } from "./v1";

// Lê o corpo JSON; corpo ausente ou inválido vira 400 dados_invalidos.
export async function corpo(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
  } catch {
    // cai no erro abaixo
  }
  throw new CamposInvalidos([{ campo: "corpo", codigo: "dados_invalidos" }]);
}

// Id da rota: uuid, senão 404 (não diz se existe em outra empresa).
export async function idDaRota(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new DomainError("nao_encontrado", 404);
  return id;
}

// Idempotency-Key (13.2): 1 a 100 caracteres, ou ausente.
export function chaveIdempotencia(req: Request): string | null {
  const k = req.headers.get("idempotency-key");
  if (k === null) return null;
  if (k.length < 1 || k.length > IDEMPOTENCIA_MAX) throw new CamposInvalidos([{ campo: "Idempotency-Key", codigo: "campo_invalido" }]);
  return k;
}

// Vaga no formato da API v1 (nomes do banco, sem nome de pessoas).
export function vagaV1(v: VagaDetalhe) {
  return VagaV1.parse({
    id: v.id, slug: v.slug, titulo: v.titulo, status: v.status, descricao: v.descricao, requisitos: v.requisitos,
    area_id: v.area?.id ?? null, dono_pessoa_id: v.dono?.id ?? null, modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf,
    regime: v.regime, salario_min: v.salario_min, salario_max: v.salario_max, salario_periodo: v.salario_periodo,
    mostrar_salario: v.mostrar_salario, curriculo_obrigatorio: v.curriculo_obrigatorio, encerra_em: v.encerra_em,
    publicada_em: v.publicada_em, encerrada_em: v.encerrada_em, motivo_encerramento: v.motivo_encerramento,
    criado_em: v.criado_em, atualizado_em: v.atualizado_em, etapas: v.etapas, perguntas: v.perguntas,
    equipe: v.equipe.map((e) => ({ membro_id: e.membro_id, papel_na_vaga: e.papel_na_vaga })),
  });
}

// Campos que o PATCH aceita (as listas têm PUT próprio).
export const CAMPOS_PATCH = [
  "titulo", "slug", "descricao", "requisitos", "area_id", "dono_pessoa_id", "modelo_trabalho", "cidade", "uf", "regime",
  "salario_min", "salario_max", "salario_periodo", "mostrar_salario", "curriculo_obrigatorio", "encerra_em",
] as const;
