// Formulário "Modelos de mensagem" (8.6; classe F, 11.29; decisão 6): editar um modelo, criar um
// novo ou voltar ao padrão, com pré-visualização com dados fictícios. Variável desconhecida é
// recusada. Recrutador+, escopo escrita, com fallback.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { listTemplates } from "@/server/messages/templates";
import { previewTemplate } from "@/server/recruiting/messages";
import type { DefinicaoFormulario } from "../registrar";
import { gravarModelo } from "./save";

const c = copy.mcp.form.modelos_mensagem;
const OPERACOES = ["editar", "criar", "padrao"] as const;

export const schemaModelo = z.object({
  operacao: z.enum(OPERACOES),
  modelo: z.string().max(60).optional(),
  chave: z.string().max(60).optional(),
  nome: z.string().max(80).optional(),
  assunto: z.string().max(200).optional(),
  corpo: z.string().max(5000).optional(),
});

export const formularioModelos: DefinicaoFormulario<typeof schemaModelo> = {
  acao: "modelos_mensagem",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    operacao: z.enum(OPERACOES).optional().describe("editar (padrão), criar ou padrao (voltar ao padrão)"),
    modelo: z.string().optional().describe("chave do modelo"),
    nome: z.string().optional(),
    assunto: z.string().optional(),
    corpo: z.string().optional(),
  }),
  async montar(args, ctx) {
    const modelos = await listTemplates(ctx.empresa.id);
    const m = modelos.find((x) => x.chave === args.modelo);
    const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
    const assunto = str("assunto") || m?.assunto || "";
    const corpo = str("corpo") || m?.corpo || "";
    const avisos = assunto && corpo ? [(() => { const p = previewTemplate(ctx.empresa, { assunto, corpo }); return c.previa(p.assunto, p.corpo); })()] : [];
    const quando = (ops: string[]) => [{ campo: "operacao", igual: ops }];
    return {
      campos: [
        { tipo: "radio", nome: "operacao", rotulo: c.operacao, opcoes: [{ valor: "editar", rotulo: c.editar }, { valor: "criar", rotulo: c.criar }, { valor: "padrao", rotulo: c.padrao }], obrigatorio: true },
        { tipo: "select", nome: "modelo", rotulo: c.modelo, opcoes: modelos.map((x) => ({ valor: x.chave, rotulo: x.nome, preencher: { nome: x.nome, assunto: x.assunto, corpo: x.corpo } })), mostrarSe: quando(["editar", "padrao"]) },
        { tipo: "texto", nome: "chave", rotulo: c.chave, max: 60, mostrarSe: quando(["criar"]) },
        { tipo: "texto", nome: "nome", rotulo: c.nome, max: 80, mostrarSe: quando(["editar", "criar"]) },
        { tipo: "texto", nome: "assunto", rotulo: c.assunto, max: 200, mostrarSe: quando(["editar", "criar"]) },
        { tipo: "textarea", nome: "corpo", rotulo: c.corpo, max: 5000, dica: copy.mcp.form.mensagem.dicaVariaveis, mostrarSe: quando(["editar", "criar"]) },
      ],
      valores: { operacao: (args.operacao as string) ?? "editar", modelo: m?.chave ?? "", chave: "", nome: str("nome") || m?.nome || "", assunto, corpo },
      botao: copy.salvar,
      avisos,
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaModelo,
  gravar: gravarModelo,
  fallback: true,
};
