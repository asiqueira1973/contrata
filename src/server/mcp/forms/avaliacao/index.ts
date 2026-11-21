// Formulário "Avaliação" (8.5; 11.9, 11.16): o membro da equipe da vaga registra a própria
// avaliação de uma candidatura numa etapa (recomendação e comentário). Escopo leitura e papel
// avaliador porque a 11.16 dá ao avaliador "leitura mais o formulário de avaliação"; a trava real é
// a equipe da vaga, conferida no banco. Sem fallback (decisão 1 do 8.5): a opinião é de quem clica,
// e sem formulário o modelo escreveria por ela.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import type { Opcao } from "@/lib/formularios";
import { LISTA_MAX } from "@/lib/limits";
import { getJob } from "@/server/recruiting/jobs";
import { getApplication, listApplications } from "@/server/recruiting/pipeline";
import { acharCandidatura, acharEtapa } from "../../candidaturas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarAvaliacao } from "./save";

const c = copy.mcp.form.avaliacao;
const RECOMENDACOES = ["forte_sim", "sim", "nao", "forte_nao"] as const;

export const schemaAvaliacao = z.object({
  candidatura: z.uuid(),
  etapa: z.uuid(),
  recomendacao: z.enum(RECOMENDACOES),
  comentario: z.string().trim().min(10).max(5000),
});

export const formularioAvaliacao: DefinicaoFormulario<typeof schemaAvaliacao> = {
  acao: "avaliacao",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "leitura",
  papel: "avaliador",
  entrada: z.object({
    candidatura: z.string().optional().describe("id da candidatura ou nome da pessoa"),
    vaga: z.string().optional().describe("título ou id da vaga, para desempatar nomes"),
    etapa: z.string().optional().describe("nome da etapa (padrão: a atual)"),
  }),
  async montar(args, ctx) {
    const eu = ctx.membro.id;
    // As que esperam a minha avaliação, mais a pedida (para editar uma avaliação já feita).
    const { itens } = await listApplications(ctx, { pendente_de: eu }, { inicio: 0, limite: LISTA_MAX });
    const lista = itens.map((i) => ({ id: i.id, nome: i.nome, vaga: i.vaga, etapa: i.etapa }));
    let pedida: string | null = null;
    let anterior: { recomendacao: string; comentario: string; etapa_id: string } | null = null;
    if (typeof args.candidatura === "string" && args.candidatura.trim()) {
      try {
        pedida = await acharCandidatura(ctx, args.candidatura, args.vaga);
        const d = await getApplication(ctx, pedida);
        if (!lista.some((i) => i.id === pedida)) lista.unshift({ id: d.id, nome: d.pessoa.nome, vaga: d.vaga, etapa: d.etapa });
        const minha = d.avaliacoes.find((a) => a.membro_id === eu && a.etapa_id === d.etapa?.id);
        if (minha) anterior = { recomendacao: minha.recomendacao, comentario: minha.comentario, etapa_id: minha.etapa_id };
      } catch {
        pedida = null; // não achou ou ambíguo: a pessoa escolhe na lista
      }
    }
    // Etapas das vagas da lista; com mais de uma vaga, o rótulo leva a vaga.
    const vagas = new Map<string, Awaited<ReturnType<typeof getJob>>>();
    for (const v of new Set(lista.map((i) => i.vaga.id))) vagas.set(v, await getJob(ctx, v));
    const variasVagas = vagas.size > 1;
    const etapas: Opcao[] = [...vagas.values()].flatMap((v) => v.etapas.map((e) => ({ valor: e.id, rotulo: variasVagas ? `${v.titulo} · ${e.nome}` : e.nome })));
    const candidaturas: Opcao[] = lista.map((i) => ({
      valor: i.id,
      rotulo: c.opcao(i.nome, i.vaga.titulo, i.etapa?.nome ?? ""),
      ...(i.etapa ? { preencher: { etapa: i.etapa.id } } : {}),
    }));
    let etapa = pedida ? lista.find((i) => i.id === pedida)?.etapa?.id ?? "" : "";
    if (pedida && typeof args.etapa === "string" && args.etapa.trim()) {
      const v = vagas.get(lista.find((i) => i.id === pedida)!.vaga.id);
      try {
        if (v) etapa = acharEtapa(v, args.etapa).id;
      } catch {
        // etapa não achada: fica a atual
      }
    }
    const avisos: string[] = [c.aviso];
    if (anterior) avisos.push(c.jaAvaliou);
    if (!candidaturas.length) avisos.push(c.nenhuma);
    return {
      campos: [
        { tipo: "select", nome: "candidatura", rotulo: c.candidatura, opcoes: candidaturas, obrigatorio: true },
        { tipo: "select", nome: "etapa", rotulo: c.etapa, opcoes: etapas, obrigatorio: true },
        { tipo: "radio", nome: "recomendacao", rotulo: c.recomendacao, opcoes: RECOMENDACOES.map((r) => ({ valor: r, rotulo: copy.funil.recomendacoes[r] })), obrigatorio: true },
        { tipo: "textarea", nome: "comentario", rotulo: c.comentario, dica: c.dicaComentario, obrigatorio: true, max: 5000 },
      ],
      valores: { candidatura: pedida ?? "", etapa, recomendacao: anterior?.recomendacao ?? "", comentario: anterior?.comentario ?? "" },
      botao: c.botao,
      avisos,
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaAvaliacao,
  gravar: gravarAvaliacao,
  fallback: false,
};
