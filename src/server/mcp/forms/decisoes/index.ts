// Formulário "Decisões" (8.6; classe D, 11.5, 11.7, 11.23): reprovar, contratar, encerrar a vaga
// com pessoas em andamento e reabrir. Uma linha por item, com o texto final ao candidato editável,
// e o total no botão. Recrutador+, escopo decisao, SEM fallback: decisão só com o clique da pessoa.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import type { Campo, ItemLista } from "@/lib/formularios";
import { DECISOES_LOTE_MAX } from "@/lib/limits";
import { db } from "@/server/db/client";
import { MOTIVOS_ENCERRAMENTO, MOTIVOS_REPROVACAO } from "@/server/recruiting/decisions";
import { getJob } from "@/server/recruiting/jobs";
import { textoFinal } from "@/server/recruiting/messages";
import { getTemplate } from "@/server/messages/templates";
import { acharCandidatura } from "../../candidaturas";
import { acharVaga } from "../../vagas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarDecisoes } from "./save";

const c = copy.mcp.form.decisoes;
const ACOES = ["reprovar", "contratar", "encerrar_vaga", "reabrir"] as const;

export const schemaDecisoes = z.object({
  itens: z.array(z.object({
    tipo: z.enum(ACOES),
    candidatura: z.uuid().optional(),
    vaga: z.uuid().optional(),
    motivo: z.union([z.enum(MOTIVOS_REPROVACAO), z.literal("")]).optional(),
    motivo_encerramento: z.union([z.enum(MOTIVOS_ENCERRAMENTO), z.literal("")]).optional(),
    assunto: z.string().max(200).optional(),
    texto: z.string().max(5000).optional(),
  })).min(1).max(DECISOES_LOTE_MAX),
});

const opcoes = (r: Record<string, string>) => Object.entries(r).map(([valor, rotulo]) => ({ valor, rotulo }));
const so = (tipos: string[]) => [{ campo: "tipo", igual: tipos }];

export const formularioDecisoes: DefinicaoFormulario<typeof schemaDecisoes> = {
  acao: "decisoes",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "decisao",
  papel: "recrutador",
  entrada: z.object({
    acao: z.enum(ACOES).optional().describe("reprovar (padrão), contratar, encerrar_vaga ou reabrir"),
    candidaturas: z.array(z.string()).max(DECISOES_LOTE_MAX).optional().describe("ids das candidaturas (ou nomes das pessoas)"),
    vaga: z.string().optional().describe("título ou id da vaga (encerrar_vaga, ou para desempatar nomes)"),
    motivo: z.enum(MOTIVOS_REPROVACAO).optional().describe("motivo interno da reprovação (não vai ao candidato)"),
    motivo_encerramento: z.enum(MOTIVOS_ENCERRAMENTO).optional(),
    devolutiva: z.string().optional().describe("texto sugerido ao candidato; a pessoa da equipe revisa e edita"),
    justificativa: z.string().optional().describe("por que você propõe isso (aparece para a pessoa que confirma)"),
  }),
  async montar(args, ctx) {
    const acao = (args.acao as (typeof ACOES)[number] | undefined) ?? "reprovar";
    const sugestao = typeof args.devolutiva === "string" && args.devolutiva.trim() ? args.devolutiva.trim() : null;
    const itens: ItemLista[] = [];
    const avisos: string[] = [];
    if (typeof args.justificativa === "string" && args.justificativa.trim()) avisos.push(c.justificativa(args.justificativa.trim()));
    if (acao === "encerrar_vaga") {
      const v = await acharVaga(ctx, args.vaga);
      if (v) {
        const vaga = await getJob(ctx, v.id);
        const { count } = await db().from("rs_candidaturas").select("id", { count: "exact", head: true }).eq("empresa_id", ctx.empresa.id).eq("vaga_id", v.id).eq("situacao", "ativa").not("recebida_em", "is", null);
        const motivo = (args.motivo_encerramento as string) || "preenchida";
        const modelo = await getTemplate(ctx.empresa.id, motivo === "cancelada" ? "devolutiva_vaga_cancelada" : "devolutiva_vaga_preenchida");
        itens.push({ _titulo: c.encerrar(vaga.titulo), _aviso: c.encerrarAviso(count ?? 0), tipo: "encerrar_vaga", vaga: v.id,
          motivo_encerramento: motivo, assunto: modelo?.assunto ?? "", texto: sugestao ?? modelo?.corpo ?? "" });
      }
    } else {
      const textos = Array.isArray(args.candidaturas) ? (args.candidaturas as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const modelo = await getTemplate(ctx.empresa.id, acao === "contratar" ? "contratacao" : "devolutiva_padrao");
      for (const t of textos.slice(0, DECISOES_LOTE_MAX)) {
        try {
          const id = await acharCandidatura(ctx, t, args.vaga);
          const base = { assunto: modelo?.assunto ?? "", corpo: sugestao ?? modelo?.corpo ?? "" };
          const f = await textoFinal(ctx, id, base);
          const titulo = acao === "contratar" ? c.contratar(f.nome, f.vaga) : acao === "reabrir" ? c.reabrir(f.nome, f.vaga) : c.reprovar(f.nome, f.vaga);
          itens.push({ _titulo: titulo, ...(acao === "reabrir" ? { _aviso: c.reabrirAviso } : {}), tipo: acao, candidatura: id,
            motivo: acao === "reprovar" ? ((args.motivo as string) ?? "") : "", assunto: acao === "reabrir" ? "" : f.assunto, texto: acao === "reabrir" ? "" : f.corpo });
        } catch {
          // não achou (ou ambíguo): fica de fora; a pessoa vê só o que dá para decidir
        }
      }
    }
    if (!itens.length) avisos.push(c.nenhuma);
    const campos: Campo[] = [{
      tipo: "lista", nome: "itens", rotulo: c.itens, rotuloItem: c.item, adicionar: "", novo: {}, fixa: true, min: 1, max: DECISOES_LOTE_MAX,
      subcampos: [
        { tipo: "select", nome: "motivo", rotulo: c.motivo, opcoes: opcoes(copy.decisoes.motivos), obrigatorio: true, mostrarSe: so(["reprovar"]) },
        { tipo: "select", nome: "motivo_encerramento", rotulo: c.motivoEncerramento, opcoes: opcoes(copy.decisoes.motivosEncerramento), obrigatorio: true, mostrarSe: so(["encerrar_vaga"]) },
        { tipo: "texto", nome: "assunto", rotulo: c.assunto, max: 200, mostrarSe: so(["reprovar", "contratar", "encerrar_vaga"]) },
        { tipo: "textarea", nome: "texto", rotulo: c.devolutiva, max: 3000, obrigatorio: true, mostrarSe: so(["reprovar", "encerrar_vaga"]) },
        { tipo: "textarea", nome: "texto", rotulo: c.mensagemContratar, max: 3000, mostrarSe: so(["contratar"]), dica: c.dicaVariaveis },
      ],
    }];
    const soReprovar = itens.length > 0 && itens.every((i) => i.tipo === "reprovar");
    return {
      campos,
      valores: { itens },
      botao: (soReprovar ? c.botaoReprovar : c.botaoConfirmar).replace("{n}", String(itens.length)),
      botaoContagem: { lista: "itens", texto: soReprovar ? c.botaoReprovar : c.botaoConfirmar },
      avisos,
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaDecisoes,
  gravar: gravarDecisoes,
  fallback: false,
};
