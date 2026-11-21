// Peças da API REST v1 (seção 13.2): guardião na primeira linha (requireCredencial com escopo),
// erros {codigo, mensagem} sem dado pessoal, paginação por cursor (padrão 50, máximo 200) e os
// schemas de resposta em zod, que também geram o OpenAPI (princípio 1: um schema, todas as portas).
import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Escopo } from "@/lib/limits";
import { requireCredencial, type ContextoCredencial } from "@/server/auth/credential";
import { errorResponse } from "@/server/http";

export const LIMITE_PADRAO = 50;
export const LIMITE_MAX = 200;

// Executa uma rota da API v1: só chave de API (rsk_), com o escopo pedido.
export async function apiRoute(req: NextRequest, escopo: Escopo, fn: (ctx: ContextoCredencial) => Promise<Response>): Promise<Response> {
  const ctx = await requireCredencial(req, ["api"], escopo);
  if (ctx instanceof Response) return ctx;
  try {
    return await fn(ctx);
  } catch (e) {
    return errorResponse(e);
  }
}

// Lê o cursor opaco (base64url de {o: deslocamento}); inválido volta ao começo. Serve à API e ao MCP.
export function lerCursor(c: string | null | undefined): number {
  try {
    return c ? Math.max(0, Number((JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as { o?: number }).o) || 0) : 0;
  } catch {
    return 0;
  }
}

// Cursor da próxima página, ou null quando não há mais.
export function proximoCursor(inicio: number, limite: number, mais: boolean): string | null {
  return mais ? Buffer.from(JSON.stringify({ o: inicio + limite })).toString("base64url") : null;
}

// Cursor opaco e limite da página.
export function pagina(req: NextRequest): { inicio: number; limite: number } {
  const sp = req.nextUrl.searchParams;
  const limite = Math.min(LIMITE_MAX, Math.max(1, Number(sp.get("limite")) || LIMITE_PADRAO));
  return { inicio: lerCursor(sp.get("cursor")), limite };
}

// Fatia a lista e devolve o próximo cursor (null no fim).
export function paginar<T>(itens: T[], p: { inicio: number; limite: number }) {
  const fatia = itens.slice(p.inicio, p.inicio + p.limite);
  const fim = p.inicio + p.limite >= itens.length;
  return { itens: fatia, proximo_cursor: fim ? null : Buffer.from(JSON.stringify({ o: p.inicio + p.limite })).toString("base64url") };
}

// Schemas de resposta (nomes do banco, seção 13).
export const Erro = z.object({ codigo: z.string(), mensagem: z.string() });
export const EmpresaV1 = z
  .object({
    empresa: z.object({ id: z.uuid(), slug: z.string(), nome: z.string() }),
    credencial: z.object({ nome: z.string(), escopos: z.array(z.enum(["leitura", "escrita", "decisao"])) }),
  });
export const AreaV1 = z
  .object({ id: z.uuid(), nome: z.string(), responsavel: z.object({ id: z.uuid(), nome: z.string() }).nullable(), vagas_abertas: z.number().int() });
export const PessoaV1 = z
  .object({ id: z.uuid(), nome: z.string(), email: z.string(), cargo: z.string().nullable(), area: z.object({ id: z.uuid(), nome: z.string() }).nullable(), tem_acesso: z.boolean() });
export const ListaAreas = z.object({ itens: z.array(AreaV1), proximo_cursor: z.string().nullable() });
export const ListaPessoas = z.object({ itens: z.array(PessoaV1), proximo_cursor: z.string().nullable() });

// ---------------------------------------------------------------- vagas (8.3)
const STATUS = z.enum(["rascunho", "publicada", "pausada", "encerrada"]);
export const EtapaV1 = z.object({ id: z.uuid(), nome: z.string(), tipo: z.enum(["triagem", "entrevista", "avaliacao", "proposta"]), ordem: z.number().int() });
export const PerguntaV1 = z.object({
  id: z.uuid(), ordem: z.number().int(), texto: z.string(), tipo: z.enum(["texto_curto", "texto_longo", "sim_nao", "escolha_unica", "numero"]),
  opcoes: z.array(z.string()), obrigatoria: z.boolean(), resposta_esperada: z.string().nullable(),
});
export const VagaV1 = z.object({
  id: z.uuid(), slug: z.string(), titulo: z.string(), status: STATUS, descricao: z.string(), requisitos: z.string().nullable(),
  area_id: z.uuid().nullable(), dono_pessoa_id: z.uuid().nullable(),
  modelo_trabalho: z.enum(["presencial", "hibrido", "remoto"]), cidade: z.string().nullable(), uf: z.string().nullable(),
  regime: z.enum(["clt", "pj", "estagio", "temporario", "aprendiz", "trainee", "freelancer", "outro"]),
  salario_min: z.number().nullable(), salario_max: z.number().nullable(), salario_periodo: z.enum(["mes", "hora"]).nullable(),
  mostrar_salario: z.boolean(), curriculo_obrigatorio: z.boolean(), encerra_em: z.string().nullable(),
  publicada_em: z.string().nullable(), encerrada_em: z.string().nullable(), motivo_encerramento: z.enum(["preenchida", "cancelada", "outro"]).nullable(),
  criado_em: z.string(), atualizado_em: z.string(),
  etapas: z.array(EtapaV1), perguntas: z.array(PerguntaV1),
  equipe: z.array(z.object({ membro_id: z.uuid(), papel_na_vaga: z.enum(["responsavel", "avaliador"]) })),
});
export const VagaNaListaV1 = z.object({
  id: z.uuid(), slug: z.string(), titulo: z.string(), status: STATUS, area_id: z.uuid().nullable(), dono_pessoa_id: z.uuid().nullable(),
  modelo_trabalho: z.enum(["presencial", "hibrido", "remoto"]), cidade: z.string().nullable(), uf: z.string().nullable(),
  publicada_em: z.string().nullable(), encerra_em: z.string().nullable(), atualizado_em: z.string(), candidaturas_ativas: z.number().int(),
});
export const ListaVagas = z.object({ itens: z.array(VagaNaListaV1), proximo_cursor: z.string().nullable() });
export const ResumoVagaV1 = z.object({
  vaga: z.object({ id: z.uuid(), titulo: z.string(), status: STATUS }),
  etapas: z.array(z.object({ id: z.uuid(), nome: z.string(), ativas: z.number().int() })),
  situacoes: z.record(z.string(), z.number().int()),
  sinalizadas: z.number().int(), paradas: z.number().int(), idade_media_dias: z.number().nullable(),
});
export const ErroCampos = Erro.extend({ campos: z.array(z.object({ campo: z.string(), codigo: z.string(), mensagem: z.string() })).optional() });
