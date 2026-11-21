// Formulário "Mensagem ao candidato" (8.6; classe F, 11.8, 11.29): modelo ou texto livre, com as
// variáveis trocadas no envio. O clique do membro é a confirmação. Recrutador+, escopo escrita;
// com fallback de prévia (13.5 permite: não é decisão).
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { listApplications } from "@/server/recruiting/pipeline";
import { listTemplates } from "@/server/messages/templates";
import { acharCandidatura } from "../../candidaturas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarMensagem } from "./save";

const c = copy.mcp.form.mensagem;

export const schemaMensagem = z.object({
  candidatura: z.uuid(),
  modelo: z.string().max(60).optional(),
  assunto: z.string().trim().min(2).max(200),
  corpo: z.string().trim().min(2).max(5000),
});

export const formularioMensagem: DefinicaoFormulario<typeof schemaMensagem> = {
  acao: "mensagem",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    candidatura: z.string().optional().describe("id da candidatura ou nome da pessoa"),
    vaga: z.string().optional().describe("título ou id da vaga, para desempatar nomes"),
    modelo: z.string().optional().describe("chave do modelo (listar_modelos_mensagem)"),
    assunto: z.string().optional(),
    corpo: z.string().optional().describe("texto sugerido; a pessoa da equipe revisa"),
  }),
  async montar(args, ctx) {
    let candidatura = "";
    try {
      if (typeof args.candidatura === "string" && args.candidatura.trim()) candidatura = await acharCandidatura(ctx, args.candidatura, args.vaga);
    } catch {
      candidatura = "";
    }
    const modelos = await listTemplates(ctx.empresa.id);
    const m = typeof args.modelo === "string" ? modelos.find((x) => x.chave === args.modelo) : undefined;
    const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
    return {
      campos: [
        { tipo: "select", nome: "candidatura", rotulo: c.candidatura, opcoes: "candidaturas", obrigatorio: true },
        { tipo: "select", nome: "modelo", rotulo: c.modelo, opcoes: modelos.map((x) => ({ valor: x.chave, rotulo: x.nome, preencher: { assunto: x.assunto, corpo: x.corpo } })), vazio: c.semModelo },
        { tipo: "texto", nome: "assunto", rotulo: c.assunto, obrigatorio: true, max: 200 },
        { tipo: "textarea", nome: "corpo", rotulo: c.corpo, obrigatorio: true, max: 5000, dica: c.dicaVariaveis },
      ],
      valores: { candidatura, modelo: m?.chave ?? "", assunto: str("assunto") || m?.assunto || "", corpo: str("corpo") || m?.corpo || "" },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const { itens } = await listApplications(ctx, { situacao: "todas" }, { inicio: 0, limite: 200 });
    return { candidaturas: itens.map((i) => ({ valor: i.id, rotulo: `${i.nome} · ${i.vaga.titulo}` })) };
  },
  schema: schemaMensagem,
  gravar: gravarMensagem,
  fallback: true,
};
