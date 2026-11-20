// Copiado de ~/agenda-psi/mcp-server/src/client-capabilities.ts (seção 13.5 do spec do Contrata).
import "server-only";
import { getUiCapability, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

/** Chave do envelope da revisão 2026-07-28 que leva as capacidades do cliente. */
const CHAVE_CAPACIDADES = 'io.modelcontextprotocol/clientCapabilities';

/**
 * Se o cliente deste request mostra MCP Apps (13.5):
 * - `sim`: anunciou a extensão `io.modelcontextprotocol/ui` com o MIME do ext-apps;
 * - `nao`: anunciou capacidades, sem essa extensão;
 * - `desconhecido`: não anunciou nada neste request. É o caso dos clientes de 2025,
 *   que só dizem as capacidades no `initialize`, e o servidor stateless não guarda o
 *   `initialize` (4.3).
 */
export type SuporteAUi = 'sim' | 'nao' | 'desconhecido';

/**
 * Lê o suporte a UI do corpo JSON-RPC já parseado. Na 2026-07-28, todo request leva
 * `params._meta["io.modelcontextprotocol/clientCapabilities"]`. No `initialize` de
 * 2025, as capacidades vêm em `params.capabilities`. Um lote (array) usa o primeiro item.
 */
export function suporteAUi(corpo: unknown): SuporteAUi {
  const msg = Array.isArray(corpo) ? corpo[0] : corpo;
  const params = (msg as { params?: Record<string, unknown> } | undefined)?.params;
  const meta = params?._meta as Record<string, unknown> | undefined;
  const caps = (meta?.[CHAVE_CAPACIDADES] ?? params?.capabilities) as Parameters<typeof getUiCapability>[0];
  if (!caps || typeof caps !== 'object') return 'desconhecido';
  return getUiCapability(caps)?.mimeTypes?.includes(RESOURCE_MIME_TYPE) ? 'sim' : 'nao';
}
