// Formulário "Resposta ao pedido de revisão" (8.6; 11.13, 11.23): a mensagem resposta_revisao e,
// se a equipe decidir, a reabertura. Recrutador+, escopo escrita; reabrir é decisão, então exige
// também o escopo decisao e não existe no fallback (soNoFormulario).
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { db } from "@/server/db/client";
import { listApplications } from "@/server/recruiting/pipeline";
import { acharCandidatura } from "../../candidaturas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarRespostaRevisao } from "./save";

const c = copy.mcp.form.resposta_revisao;

export const schemaRespostaRevisao = z.object({
  candidatura: z.uuid(),
  assunto: z.string().trim().min(2).max(200),
  corpo: z.string().trim().min(2).max(5000),
  reabrir: z.boolean().optional(),
});

// Pedidos de revisão esperando resposta, no alcance.
async function pendentes(ctx: Parameters<DefinicaoFormulario<typeof schemaRespostaRevisao>["opcoes"]>[0]) {
  const { itens } = await listApplications(ctx, { situacao: "todas" }, { inicio: 0, limite: 200 });
  if (!itens.length) return [];
  const { data } = await db().from("rs_candidaturas").select("id, revisao_texto").in("id", itens.map((i) => i.id))
    .not("revisao_pedida_em", "is", null).is("revisao_respondida_em", null);
  const texto = new Map((data ?? []).map((d) => [d.id, d.revisao_texto as string | null]));
  return itens.filter((i) => texto.has(i.id)).map((i) => ({ ...i, texto: texto.get(i.id) ?? null }));
}

export const formularioRespostaRevisao: DefinicaoFormulario<typeof schemaRespostaRevisao> = {
  acao: "resposta_revisao",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    candidatura: z.string().optional().describe("id da candidatura ou nome da pessoa"),
    corpo: z.string().optional().describe("resposta sugerida; a pessoa da equipe revisa"),
    reabrir: z.boolean().optional().describe("sugere reabrir (só a pessoa confirma)"),
  }),
  async montar(args, ctx) {
    const lista = await pendentes(ctx);
    let id = "";
    try {
      if (typeof args.candidatura === "string" && args.candidatura.trim()) id = await acharCandidatura(ctx, args.candidatura);
    } catch {
      id = "";
    }
    const atual = lista.find((x) => x.id === id);
    return {
      campos: [
        { tipo: "select", nome: "candidatura", rotulo: c.candidatura, opcoes: lista.map((x) => ({ valor: x.id, rotulo: `${x.nome} · ${x.vaga.titulo}` })), obrigatorio: true },
        { tipo: "texto", nome: "assunto", rotulo: c.assunto, obrigatorio: true, max: 200 },
        { tipo: "textarea", nome: "corpo", rotulo: c.corpo, obrigatorio: true, max: 5000, dica: copy.mcp.form.mensagem.dicaVariaveis },
        { tipo: "marcar", nome: "reabrir", rotulo: c.reabrir },
      ],
      valores: { candidatura: atual?.id ?? "", assunto: c.assuntoPadrao, corpo: typeof args.corpo === "string" ? args.corpo : "", reabrir: args.reabrir === true },
      botao: c.botao,
      avisos: lista.length ? lista.map((x) => c.pedido(x.nome, x.texto)) : [c.nenhum],
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaRespostaRevisao,
  gravar: gravarRespostaRevisao,
  fallback: true,
  // Reabrir é decisão (11.7, 11.23): só com o clique no formulário.
  soNoFormulario: (d) => d.reabrir === true,
};
