// Registrador genérico de formulários (princípio 6, 13.3, 13.5). Para cada ação:
// - abrir_formulario_<acao> (visível ao modelo): monta o formulário já preenchido; NÃO grava;
// - opcoes_<acao> (só do formulário): listas de opções;
// - salvar_<acao> (só do formulário): revalida (zod + domínio) e grava; o clique é da pessoa;
// - registrar_<acao> (visível ao modelo, só em cliente sem MCP Apps): prévia com token e, na
//   segunda chamada, grava. Decisões (8.6) não terão este fallback.
// Guardas: escopo efetivo e papel mínimo no registro (a ferramenta nem aparece) e de novo na chamada.
import "server-only";
import { randomUUID } from "node:crypto";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import type { Formulario, Opcao, RespostaSalvar } from "@/lib/formularios";
import type { Escopo, Papel } from "@/lib/limits";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { atorDoFormulario } from "@/server/org/actor";
import { bloqueio, comoResultado, erro, erroDoDominio, resposta, type ToolContext } from "../kit";
import { conferirTokenDePrevia, emitirTokenDePrevia } from "../preview-token";
import { FORMULARIO_URI } from "../ui";

// Contexto de um formulário: o membro (8.1) mais os escopos efetivos da conexão (11.16). O papel
// não basta: um administrador conectado só com leitura não pode o que exige escrita.
export type ContextoFormulario = ContextoMembro & { escopos: Escopo[] };

export type DefinicaoFormulario<S extends z.ZodObject> = {
  acao: string;
  titulo: string;
  descricao: string;
  escopo: Escopo;
  papel: Papel;
  // Entrada de abrir_formulario_*: o que o modelo já sabe, tudo opcional.
  entrada: z.ZodObject;
  montar: (args: Record<string, unknown>, ctx: ContextoFormulario) => Promise<Omit<Formulario, "formulario_id" | "acao" | "titulo" | "ferramentaOpcoes">>;
  opcoes: (ctx: ContextoFormulario) => Promise<Record<string, Opcao[]>>;
  schema: S;
  // Grava com o ator recebido (formulário: o membro; fallback: o agente). Lança erro de domínio.
  gravar: (dados: z.infer<S>, ctx: ContextoFormulario) => Promise<RespostaSalvar & { ok: true }>;
  fallback: boolean;
};

// Valida a entrada do salvar com o schema do formulário; erros por campo, sem valores (20.2).
function validar<S extends z.ZodObject>(schema: S, args: unknown): { ok: true; dados: z.infer<S> } | { ok: false; r: RespostaSalvar } {
  const p = schema.safeParse(args);
  if (p.success) return { ok: true, dados: p.data };
  const campos = [...new Set(p.error.issues.map((i) => String(i.path[0] ?? "")))];
  return { ok: false, r: { ok: false, erros: campos.map((c) => ({ campo: c || null, mensagem: ERROS.campo_invalido })) } };
}

async function gravarComTratamento<S extends z.ZodObject>(def: DefinicaoFormulario<S>, dados: z.infer<S>, ctx: ContextoFormulario): Promise<RespostaSalvar> {
  try {
    return await def.gravar(dados, ctx);
  } catch (e) {
    return { ok: false, erros: erroDoDominio(e) };
  }
}

export function registrarFormulario<S extends z.ZodObject>(server: McpServer, ctx: ToolContext, def: DefinicaoFormulario<S>): void {
  if (bloqueio(ctx, def.escopo, def.papel)) return; // sem permissão, a ferramenta nem aparece
  const membro: ContextoFormulario = { ...ctx.membro!, escopos: ctx.escopos };
  const guarda = () => bloqueio(ctx, def.escopo, def.papel);
  const c = copy.mcp;
  const opcoesNome = `opcoes_${def.acao}`;
  // O SDK não infere o tipo de um schema genérico (como no Agenda Psi); a validação em tempo de
  // execução é a do zod, em validar().
  const schemaSalvar = def.schema as unknown as z.ZodObject<z.ZodRawShape>;

  if (ctx.ui !== "nao") {
    registerAppTool(
      server,
      `abrir_formulario_${def.acao}`,
      { title: def.titulo, description: def.descricao, inputSchema: def.entrada, _meta: { ui: { resourceUri: FORMULARIO_URI, visibility: ["model"] } } },
      async (args: Record<string, unknown>) => {
        const b = guarda();
        if (b) return erro(b);
        const corpo = await def.montar(args, membro);
        const formulario: Formulario = { formulario_id: randomUUID(), acao: def.acao, titulo: def.titulo, ferramentaOpcoes: opcoesNome, ...corpo };
        return resposta(formulario as unknown as Record<string, unknown>, c.formularioAberto(def.titulo));
      },
    );
    registerAppTool(
      server,
      opcoesNome,
      { title: c.tituloOpcoes(def.titulo), description: c.descricaoOpcoes(def.titulo), inputSchema: z.object({}), _meta: { ui: { resourceUri: FORMULARIO_URI, visibility: ["app"] } } },
      async () => {
        const b = guarda();
        if (b) return erro(b);
        try {
          return resposta({ opcoes: await def.opcoes(membro) }, "ok");
        } catch (e) {
          return resposta({ erros: erroDoDominio(e) }, c.ui.erroOpcoes, true);
        }
      },
    );
    registerAppTool(
      server,
      `salvar_${def.acao}`,
      { title: c.tituloSalvar(def.titulo), description: c.descricaoSalvar(def.titulo), inputSchema: schemaSalvar, _meta: { ui: { resourceUri: FORMULARIO_URI, visibility: ["app"] } } },
      async (args: unknown) => {
        const b = guarda();
        if (b) return erro(b);
        const v = validar(def.schema, args);
        if (!v.ok) return comoResultado(v.r);
        // Quem clicou é a pessoa: o ator é o membro, com origem "formulario" (11.34).
        return comoResultado(await gravarComTratamento(def, v.dados, { ...membro, ator: atorDoFormulario(membro.ator) }));
      },
    );
  }

  if (def.fallback && ctx.ui !== "sim") {
    const entrada = def.schema.extend({
      confirmar: z.boolean().optional().describe("true só depois de mostrar a prévia à pessoa e ela concordar"),
      token_previa: z.string().optional().describe("o token devolvido pela prévia"),
    });
    server.registerTool(
      `registrar_${def.acao}`,
      { title: c.tituloFallback(def.titulo), description: c.descricaoFallback(def.titulo), inputSchema: entrada, _meta: { ui: { visibility: ["model"] } } },
      async (args: Record<string, unknown>) => {
        const b = guarda();
        if (b) return erro(b);
        const { confirmar, token_previa, ...resto } = args;
        const v = validar(def.schema, resto);
        if (!v.ok) return resposta(v.r as unknown as Record<string, unknown>, c.nadaGravado, true);
        const acao = `registrar_${def.acao}`;
        // Sem segredo de 32+ caracteres, o fallback não assina nada (13.5).
        const segredo = process.env.MCP_PREVIEW_SECRET ?? "";
        if (segredo.length < 32) {
          console.error("erro_interno_mcp", "MCP_PREVIEW_SECRET ausente");
          return erro("generico");
        }
        if (!confirmar) {
          const token = emitirTokenDePrevia(segredo, ctx.credencial.id, acao, v.dados);
          return resposta({ ok: true, previa: v.dados, token_previa: token }, c.previaPronta);
        }
        const conferencia = conferirTokenDePrevia(segredo, ctx.credencial.id, acao, v.dados, token_previa);
        if (conferencia === "divergente") return erro("previa_divergente");
        if (conferencia !== "ok") return erro("previa_invalida");
        // Sem formulário, quem grava é o agente, depois de a pessoa concordar na conversa.
        return comoResultado(await gravarComTratamento(def, v.dados, membro));
      },
    );
  }
}
