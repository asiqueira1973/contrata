// Utilidades das rotas HTTP — convenções da seção 13: erros {codigo, mensagem} em português, sem
// dado pessoal; escrita pela web só com Origin = NEXT_PUBLIC_SITE_URL (20.3).
import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ERROS, mensagemDeErro } from "@/lib/copy";
import { errorCode } from "./error-code";

// Erro de regra do domínio, com o código da copy e o status HTTP.
export class DomainError extends Error {
  constructor(public codigo: string, public status = 422) {
    super(codigo);
  }
}

// Status HTTP de cada código de regra que o banco levanta (P0001) ou o domínio lança.
const STATUS: Record<string, number> = {
  nao_autenticado: 401,
  origem_invalida: 403,
  sem_permissao: 403,
  sem_permissao_criar_empresa: 403,
  nao_encontrado: 404,
  convite_invalido: 404,
  slug_em_uso: 409,
  membro_ja_existe: 409,
  area_nome_em_uso: 409,
  pessoa_email_em_uso: 409,
  email_em_uso: 409,
  convite_vencido: 410,
};

// Resposta de erro padrão. Recebe: código e status (opcional). Devolve: Response JSON.
export function jsonError(codigo: string, status?: number, extra?: Record<string, unknown>): Response {
  return Response.json({ codigo, mensagem: mensagemDeErro(codigo), ...extra }, { status: status ?? STATUS[codigo] ?? 422 });
}

// Converte qualquer erro em resposta. Código de regra conhecido (DomainError ou P0001 do banco
// com mensagem na copy) vira 4xx com a copy; o resto é 500, com só o código no log (nunca a
// mensagem livre, que pode trazer dado pessoal, seção 20.2).
export function errorResponse(e: unknown): Response {
  if (e instanceof DomainError) return jsonError(e.codigo, e.status);
  const codigo = errorCode(e);
  if (codigo in ERROS) return jsonError(codigo);
  console.error("rota_falhou", codigo);
  return jsonError("generico", 500);
}

// Seção 20.3 (CSRF): escrita só com Origin igual ao site.
export function originAllowed(req: NextRequest): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return !!origin && !!site && origin === new URL(site).origin;
}

// Lê e valida o corpo JSON com o schema compartilhado (princípio 1: o mesmo zod nas portas).
// Devolve: os dados, ou uma Response 400 com os campos inválidos (só os nomes, sem valores).
export async function parseBody<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("dados_invalidos", 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const campos = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);
    return jsonError("dados_invalidos", 400, { campos });
  }
  return parsed.data;
}
