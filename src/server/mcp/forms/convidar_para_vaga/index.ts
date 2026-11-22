// Formulário "Convidar do banco de talentos" (8.7; classe F, 13.3, 15.4): pessoas do banco (só
// consentidas e no prazo, no alcance), uma vaga publicada do alcance e o texto do modelo convite_vaga,
// editável. Não cria candidatura. Recrutador+, escopo escrita, com fallback de prévia.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { DECISOES_LOTE_MAX, FUSO, LISTA_MAX } from "@/lib/limits";
import { listJobs } from "@/server/recruiting/jobs";
import { searchTalents } from "@/server/recruiting/talents";
import { getTemplate } from "@/server/messages/templates";
import { acharPorNome } from "../comum";
import { acharVaga } from "../../vagas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarConvites } from "./save";

const c = copy.mcp.form.convidar_para_vaga;
const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });

export const schemaConvites = z.object({
  candidatos: z.array(z.uuid()).min(1).max(DECISOES_LOTE_MAX),
  vaga: z.uuid(),
  assunto: z.string().trim().min(2).max(200),
  corpo: z.string().trim().min(2).max(5000),
});

export const formularioConvidarParaVaga: DefinicaoFormulario<typeof schemaConvites> = {
  acao: "convidar_para_vaga",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    vaga: z.string().optional().describe("título ou id da vaga publicada"),
    candidatos: z.array(z.string()).max(DECISOES_LOTE_MAX).optional().describe("ids (candidato_id de buscar_talentos) ou nomes"),
    busca: z.string().optional().describe("texto para filtrar o banco de talentos"),
    corpo: z.string().optional().describe("texto sugerido; a pessoa da equipe revisa"),
  }),
  async montar(args, ctx) {
    const { itens } = await searchTalents(ctx, typeof args.busca === "string" && args.busca.trim() ? { q: args.busca } : {}, { inicio: 0, limite: LISTA_MAX });
    const pedidos = Array.isArray(args.candidatos) ? (args.candidatos as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const marcados = pedidos.map((t) => itens.find((i) => i.candidato_id === t) ?? acharPorNome(itens, t)).filter((x): x is NonNullable<typeof x> => !!x).map((i) => i.candidato_id);
    const vaga = await acharVaga(ctx, args.vaga);
    const modelo = await getTemplate(ctx.empresa.id, "convite_vaga");
    return {
      campos: [
        { tipo: "multipla", nome: "candidatos", rotulo: c.candidatos, opcoes: itens.map((i) => ({ valor: i.candidato_id, rotulo: c.opcao(i.nome, i.cidade, DATA.format(new Date(i.no_banco_ate))) })), obrigatorio: true },
        { tipo: "select", nome: "vaga", rotulo: c.vaga, opcoes: "vagas", obrigatorio: true },
        { tipo: "texto", nome: "assunto", rotulo: c.assunto, obrigatorio: true, max: 200 },
        { tipo: "textarea", nome: "corpo", rotulo: c.corpo, obrigatorio: true, max: 5000, dica: copy.mcp.form.mensagem.dicaVariaveis },
      ],
      valores: {
        candidatos: [...new Set(marcados)], vaga: vaga?.status === "publicada" ? vaga.id : "",
        assunto: modelo?.assunto ?? "", corpo: typeof args.corpo === "string" && args.corpo.trim() ? args.corpo : modelo?.corpo ?? "",
      },
      botao: c.botao,
      avisos: itens.length ? [] : [c.nenhum],
    };
  },
  async opcoes(ctx) {
    const { itens } = await listJobs(ctx, { status: "publicada" }, { inicio: 0, limite: LISTA_MAX });
    return { vagas: itens.map((v) => ({ valor: v.id, rotulo: v.titulo })) };
  },
  schema: schemaConvites,
  gravar: gravarConvites,
  fallback: true,
};
