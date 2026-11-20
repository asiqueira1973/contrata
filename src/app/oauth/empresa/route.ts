// POST /oauth/empresa — cria a empresa na tela de consentimento (6.4; regra 11.33: só e-mails de
// CRIACAO_EMPRESA_EMAILS). Corpo: {nome, slug, email_contato}. Devolve 201 {id, slug}.
// Sem porta de API v1 nem MCP (seção 5): a empresa nasce antes de existir o token.
import type { NextRequest } from "next/server";
import { criarEmpresaSchema } from "@/lib/schemas/org";
import { requireUsuario } from "@/server/auth/require-usuario";
import { errorResponse, parseBody } from "@/server/http";
import { createCompany } from "@/server/org/companies";

export async function POST(req: NextRequest) {
  const usuario = await requireUsuario(req);
  if (usuario instanceof Response) return usuario;
  const body = await parseBody(req, criarEmpresaSchema);
  if (body instanceof Response) return body;
  try {
    return Response.json(await createCompany(usuario, body), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
