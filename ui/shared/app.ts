// Bootstrap comum do formulário (copiado do Agenda Psi, ui/shared/app.ts; seção 16): cria o App do
// ext-apps com os handlers ANTES do connect (o resultado da ferramenta chega uma vez só), aplica o
// tema do host (claro/escuro, variáveis e fontes) e responde vazio ao teardown.
import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { NOME_PRODUTO } from "@/lib/copy";

export function criarFormulario(onResultado: (r: CallToolResult) => void, onConectado: (app: App) => void): App {
  const app = new App({ name: `${NOME_PRODUTO} — formulário`, version: "0.2.0" });
  app.ontoolresult = (r) => onResultado(r as CallToolResult);
  app.onhostcontextchanged = aplicarTema;
  app.onteardown = async () => ({});
  void app.connect().then(() => {
    aplicarTema(app.getHostContext());
    onConectado(app);
  });
  return app;
}

export function aplicarTema(ctx: McpUiHostContext | undefined): void {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Cria um elemento com atributos e filhos, sem innerHTML (nada de injeção).
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...filhos: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("aria-") || k.startsWith("data-") || k === "for") e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...filhos);
  return e;
}
