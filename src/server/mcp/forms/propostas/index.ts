// Formulário "Propostas" (8.6; classe D, 11.7, 12.3): as propostas pendentes feitas por integração
// ou pelo agente sem formulário, uma por linha, com quem propôs, a justificativa e o texto ao
// candidato editável; confirmar ou descartar cada uma. A que não vale mais aparece com o motivo.
// Recrutador+, escopo decisao, SEM fallback.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import type { ItemLista } from "@/lib/formularios";
import { DECISOES_LOTE_MAX } from "@/lib/limits";
import { listProposals } from "@/server/recruiting/decisions";
import type { DefinicaoFormulario } from "../registrar";
import { gravarPropostas } from "./save";

const c = copy.mcp.form.propostas;

export const schemaPropostas = z.object({
  itens: z.array(z.object({
    decisao: z.uuid(),
    acao: z.enum(["confirmar", "descartar"]),
    assunto: z.string().max(200).optional(),
    texto: z.string().max(5000).optional(),
    motivo: z.string().max(500).optional(),
  })).min(1).max(DECISOES_LOTE_MAX),
});

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export const formularioPropostas: DefinicaoFormulario<typeof schemaPropostas> = {
  acao: "propostas",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "decisao",
  papel: "recrutador",
  entrada: z.object({}),
  async montar(_args, ctx) {
    const pendentes = (await listProposals(ctx, { status: "pendente" })).slice(0, DECISOES_LOTE_MAX);
    const itens: ItemLista[] = pendentes.map((p) => {
      const pl = p.payload as Record<string, string | undefined>;
      const texto = pl.devolutiva ?? pl.mensagem ?? pl.corpo ?? "";
      const assunto = pl.assunto ?? (p.tipo === "contratar" ? copy.modelos.contratacao.assunto : copy.modelos.devolutiva_padrao.assunto);
      return {
        _titulo: c.titulo_item(copy.decisoes.tipos[p.tipo] ?? p.tipo, p.candidatura?.nome ?? "", p.vaga?.titulo ?? ""),
        _info: c.info(p.proposta_por, data(p.criado_em), p.justificativa),
        ...(p.invalida ? { _aviso: p.invalida } : {}),
        decisao: p.id, acao: p.invalida ? "descartar" : "confirmar", assunto, texto, motivo: "",
      };
    });
    return {
      campos: [{
        tipo: "lista", nome: "itens", rotulo: c.itens, rotuloItem: c.item, adicionar: "", novo: {}, fixa: true, min: 1, max: DECISOES_LOTE_MAX,
        subcampos: [
          { tipo: "select", nome: "acao", rotulo: c.acao, opcoes: [{ valor: "confirmar", rotulo: c.confirmar }, { valor: "descartar", rotulo: c.descartar }], obrigatorio: true },
          { tipo: "texto", nome: "assunto", rotulo: c.assunto, max: 200, mostrarSe: [{ campo: "acao", igual: "confirmar" }] },
          { tipo: "textarea", nome: "texto", rotulo: c.texto, max: 5000, mostrarSe: [{ campo: "acao", igual: "confirmar" }] },
          { tipo: "texto", nome: "motivo", rotulo: c.motivoDescarte, max: 500, mostrarSe: [{ campo: "acao", igual: "descartar" }] },
        ],
      }],
      valores: { itens },
      botao: c.botao.replace("{n}", String(itens.length)),
      botaoContagem: { lista: "itens", texto: c.botao },
      avisos: itens.length ? [] : [c.vazio],
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaPropostas,
  gravar: gravarPropostas,
  fallback: false,
};
