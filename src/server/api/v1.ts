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

// Cursor opaco (base64url de {o: deslocamento}) e limite da página.
export function pagina(req: NextRequest): { inicio: number; limite: number } {
  const sp = req.nextUrl.searchParams;
  const limite = Math.min(LIMITE_MAX, Math.max(1, Number(sp.get("limite")) || LIMITE_PADRAO));
  let inicio = 0;
  try {
    const c = sp.get("cursor");
    if (c) inicio = Math.max(0, Number((JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as { o?: number }).o) || 0);
  } catch {
    inicio = 0;
  }
  return { inicio, limite };
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
