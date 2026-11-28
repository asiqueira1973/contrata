// /mcp — servidor MCP do Contrata (seções 4, 6.3, 6.4 e 13.3), stateless, no SDK v2.
// 1) requireCredencial (token rsm_… do conector ou chave rsk_…); sem credencial válida, 401 com
//    WWW-Authenticate apontando os metadados (é assim que o "Adicionar conector" acha o OAuth);
// 2) lê o corpo uma vez para saber se o cliente mostra MCP Apps (13.5) e repassa ao SDK;
// 3) monta um McpServer só com as ferramentas que a credencial pode usar e responde;
// 4) só tools/call aceito conta como uso (seção 21); pedido recusado pelo SDK vira log mcp_rejeitado.
import type { NextRequest } from "next/server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { requireCredencial } from "@/server/auth/credential";
import { suporteAUi } from "@/server/mcp/client-capabilities";
import { buildMcpServer } from "@/server/mcp/server";
import { corsHeaders, resourceMetadataUrl } from "@/server/oauth/server";
import { deliverDueLater } from "@/server/webhooks/deliver";
import { trackApiCall } from "@/server/analytics/client";
import { MCP_LOG_ERRO_MAX, MCP_LOG_USER_AGENT_MAX } from "@/lib/limits";

// Runtime Node (o padrão): o SDK usa node:crypto. Com Cache Components, "runtime" não pode ser declarado.
export const maxDuration = 60;

// Copia a resposta acrescentando o CORS (clientes de navegador também chamam /mcp).
function withCors(res: Response, extra: Record<string, string> = {}): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...corsHeaders(), ...extra })) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Método JSON-RPC do corpo, só se for um nome curto (nada do corpo além disso vai a log ou evento).
// Recebe: o corpo lido. Devolve: ex. "tools/call", ou null (lote, ausente ou fora do padrão).
function metodoJsonRpc(corpo: unknown): string | null {
  const m = corpo && typeof corpo === "object" && !Array.isArray(corpo) ? (corpo as { method?: unknown }).method : undefined;
  return typeof m === "string" && /^[a-z_/]{1,40}$/i.test(m) ? m : null;
}

// Diagnóstico do pedido que o SDK recusou (status >= 400): status, métodos, versão do protocolo,
// user-agent e error.message, sem error.data (pode trazer trecho do corpo). Nada pessoal, nenhum token.
async function logRejeitado(req: NextRequest, res: Response, metodo: string | null): Promise<void> {
  const corpo = (await res.clone().json().catch(() => null)) as { error?: { message?: unknown } } | null;
  const erro = typeof corpo?.error?.message === "string" ? corpo.error.message.slice(0, MCP_LOG_ERRO_MAX) : null;
  console.warn("mcp_rejeitado", {
    status: res.status,
    metodo_http: req.method,
    metodo,
    versao: req.headers.get("mcp-protocol-version")?.slice(0, 20) ?? null,
    user_agent: req.headers.get("user-agent")?.slice(0, MCP_LOG_USER_AGENT_MAX) ?? null,
    erro,
  });
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
  const metodo = metodoJsonRpc(corpo);
  if (res.status >= 400) {
    await logRejeitado(req, res, metodo);
    return withCors(res);
  }
  // Uma ferramenta de escrita pode ter gerado evento com webhook (8.8): entrega as vencidas da empresa.
  if (req.method === "POST") deliverDueLater(ctx.empresa.id);
  // Evento de produto (seção 21), amostrado por credencial. Só tools/call: todo Claude com o conector
  // se conecta sozinho ao abrir (initialize, tools/list, notificações), e isso não é uso.
  if (metodo === "tools/call") {
    trackApiCall(ctx.credencial.id, ctx.credencial.tipo === "api" ? { empresa: ctx.empresa.id } : { credencial: ctx.credencial.id }, "/mcp", res.status, "mcp");
  }
  return withCors(res);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
