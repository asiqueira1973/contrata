// /mcp — servidor MCP do Contrata (seções 4, 6.3, 6.4 e 13.3), stateless, no SDK v2.
// 1) requireCredencial (token rsm_… do conector ou chave rsk_…); sem credencial válida, 401 com
//    WWW-Authenticate apontando os metadados (é assim que o "Adicionar conector" acha o OAuth);
// 2) lê o corpo uma vez para saber se o cliente mostra MCP Apps (13.5) e repassa ao SDK;
// 3) monta um McpServer só com as ferramentas que a credencial pode usar e responde.
import type { NextRequest } from "next/server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { requireCredencial } from "@/server/auth/credential";
import { suporteAUi } from "@/server/mcp/client-capabilities";
import { buildMcpServer } from "@/server/mcp/server";
import { corsHeaders, resourceMetadataUrl } from "@/server/oauth/server";

// Runtime Node (o padrão): o SDK usa node:crypto. Com Cache Components, "runtime" não pode ser declarado.
export const maxDuration = 60;

// Copia a resposta acrescentando o CORS (clientes de navegador também chamam /mcp).
function withCors(res: Response, extra: Record<string, string> = {}): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...corsHeaders(), ...extra })) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handle(req: NextRequest): Promise<Response> {
  const ctx = await requireCredencial(req, ["mcp", "api"]);
  if (ctx instanceof Response) {
    return withCors(ctx, ctx.status === 401 ? { "www-authenticate": `Bearer resource_metadata="${resourceMetadataUrl()}"` } : {});
  }
  const corpo: unknown = req.method === "POST" ? await req.clone().json().catch(() => undefined) : undefined;
  const ui = suporteAUi(corpo);
  const handler = createMcpHandler(() => buildMcpServer({ ...ctx, ui }));
  const authInfo = { token: "", clientId: ctx.credencial.id, scopes: ctx.escopos, extra: { ui } };
  const res = await handler.fetch(req, corpo === undefined ? { authInfo } : { authInfo, parsedBody: corpo });
  return withCors(res);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
