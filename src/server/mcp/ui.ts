// Recurso MCP Apps do formulário genérico (13.3): o HTML de ui/formulario, montado por
// scripts/build-ui.mts e embutido em ./ui/generated.ts (fora do git). O endereço leva o hash do
// conteúdo: o Claude guarda o HTML em cache por endereço (pegadinha do Agenda Psi). Sem
// _meta.ui.csp: vale o padrão do ext-apps (connect-src 'none'); o formulário só fala com o
// servidor por callServerTool.
import "server-only";
import { createHash } from "node:crypto";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { NOME_PRODUTO } from "@/lib/copy";
import { FORMULARIO_HTML } from "./ui/generated";

export const FORMULARIO_URI = `ui://contrata/formulario-${createHash("sha256").update(FORMULARIO_HTML).digest("hex").slice(0, 12)}.html`;

// Registra o HTML do formulário como recurso (uma vez por servidor).
export function registrarRecursoDoFormulario(server: McpServer): void {
  registerAppResource(server, `${NOME_PRODUTO} — formulário`, FORMULARIO_URI, { mimeType: RESOURCE_MIME_TYPE, description: NOME_PRODUTO }, async () => ({
    contents: [{ uri: FORMULARIO_URI, mimeType: RESOURCE_MIME_TYPE, text: FORMULARIO_HTML }],
  }));
}
