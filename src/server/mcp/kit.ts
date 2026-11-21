// Peças comuns das ferramentas do MCP (seção 13.3): formato das respostas, título e dicas de
// toda ferramenta num lugar só (como o anotacoes.ts do Agenda Psi), guardas de escopo e papel e a
// conversão de erros do domínio em mensagens da copy (sem dado pessoal, 20.2).
import "server-only";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { ERROS, copy, mensagemDeErro } from "@/lib/copy";
import type { ErroDeCampo, RespostaSalvar } from "@/lib/formularios";
import type { Escopo, Papel } from "@/lib/limits";
import type { ContextoCredencial } from "@/server/auth/credential";
import { papelAtende } from "@/server/auth/require-membro";
import { errorCode } from "@/server/error-code";
import { CamposInvalidos, DomainError } from "@/server/http";
import type { SuporteAUi } from "./client-capabilities";

export type ToolContext = ContextoCredencial & { ui: SuporteAUi };

// Resultado MCP com texto curto e estrutura (13.3).
export function resposta(estrutura: Record<string, unknown>, texto: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: texto }], structuredContent: estrutura, ...(isError ? { isError } : {}) };
}

// Erro de ferramenta para o modelo se corrigir: texto curto da copy.
export function erro(codigo: string): CallToolResult {
  return resposta({ codigo }, mensagemDeErro(codigo), true);
}

// Converte uma resposta de salvar_* em resultado MCP. O texto nunca leva o segredo (chave de API).
export function comoResultado(r: RespostaSalvar): CallToolResult {
  const texto = r.ok ? r.resumo : r.erros.map((e) => e.mensagem).join(" ");
  return { content: [{ type: "text", text: texto }], structuredContent: r as unknown as Record<string, unknown>, ...(r.ok ? {} : { isError: true }) };
}

// Erro do domínio (DomainError ou P0001 do banco) vira a mensagem da copy; o resto, a genérica.
export function erroDoDominio(e: unknown): ErroDeCampo[] {
  // Campo vazio = erro geral (ex.: o que falta para publicar, num formulário que só tem a vaga).
  if (e instanceof CamposInvalidos) return e.campos.map((c) => ({ campo: c.campo || null, mensagem: ERROS[c.codigo] ?? ERROS.campo_invalido }));
  const codigo = e instanceof DomainError ? e.codigo : errorCode(e);
  if (codigo in ERROS) return [{ campo: null, mensagem: ERROS[codigo] }];
  console.error("erro_interno_mcp", codigo);
  return [{ campo: null, mensagem: copy.mcp.ui.inesperado }];
}

// A credencial pode usar a ferramenta? Escopo efetivo (11.16) e papel mínimo do membro (seção 5).
// Ferramenta que exige papel não serve à chave de API (não há membro). Devolve o código do erro ou null.
export function bloqueio(ctx: ContextoCredencial, escopo: Escopo, papel?: Papel): string | null {
  if (!ctx.escopos.includes(escopo)) return "escopo_insuficiente";
  if (!papel) return null;
  if (!ctx.membro) return "precisa_de_membro";
  return papelAtende(ctx.membro.membro.papel, papel) ? null : "papel_insuficiente";
}

// Executa uma consulta e devolve texto (JSON) + structuredContent; exceção vira mensagem genérica.
export async function consultar(fn: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const r = await fn();
    return resposta(r, JSON.stringify(r));
  } catch (e) {
    const codigo = e instanceof DomainError ? e.codigo : errorCode(e);
    if (codigo in ERROS) return erro(codigo);
    console.error("erro_interno_mcp", codigo);
    return erro("generico");
  }
}

type Config = { title?: string; annotations?: Record<string, unknown> } & Record<string, unknown>;

// Operações diretas do agente (classe O, 11.34): gravam sem formulário, então são escrita.
export const OPERACOES = new Set(["mover_etapa", "adicionar_nota", "propor_decisao"]);

// Todo registro de ferramenta ganha título e dicas: leitura (consultas, opções e abrir_formulario_*,
// que não gravam) ou escrita (salvar_*, registrar_* e as operações da classe O). openWorldHint é sempre false: a ferramenta
// só age sobre a empresa da credencial. Ferramenta sem título faz o registro falhar.
export function exigirAnotacoes(server: McpServer): void {
  const original = server.registerTool.bind(server) as (nome: string, config: Config, cb: unknown) => unknown;
  (server as unknown as { registerTool: typeof original }).registerTool = (nome, config, cb) => {
    const title = config.title;
    if (!title) throw new Error(`ferramenta sem título: ${nome}`);
    // Operações (mover, anotar) gravam, mas são reversíveis: escrita sem ser destrutiva.
    const formulario = /^(salvar|registrar)_/.test(nome);
    const escrita = formulario || OPERACOES.has(nome);
    const annotations = { ...config.annotations, title, readOnlyHint: !escrita, destructiveHint: formulario, openWorldHint: false };
    return original(nome, { ...config, annotations }, cb);
  };
}
