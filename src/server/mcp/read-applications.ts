// Consultas de candidatura do MCP (8.5; classe C, 13.3): listar_candidaturas, buscar_candidaturas,
// ver_candidatura, ler_curriculo, historico_da_candidatura e exportar_candidaturas. Sempre no
// alcance (11.32); avaliador com a visão da 11.9. O que a pessoa candidata escreveu (respostas e
// currículo) volta dentro de conteudo_do_candidato, marcado como dado (20.3).
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { FILTRO_PARADAS_DIAS, LISTA_PADRAO } from "@/lib/limits";
import { lerCursor, proximoCursor } from "@/server/api/v1";
import { DomainError } from "@/server/http";
import { exportApplications, getApplication, history, listApplications, readResume, type FiltrosCandidaturas } from "@/server/recruiting/pipeline";
import { listProposals } from "@/server/recruiting/decisions";
import { listTemplates } from "@/server/messages/templates";
import { acharCandidatura, acharEtapa } from "./candidaturas";
import type { ToolContext } from "./kit";
import { consulta } from "./read";
import { getJob } from "@/server/recruiting/jobs";
import { acharVaga } from "./vagas";

const SITUACOES = ["ativa", "reprovada", "desistiu", "contratada", "encerrada_vaga", "todas"] as const;

const filtrosArgs = {
  vaga: z.string().optional().describe("título da vaga (ou parte dele) ou o id"),
  etapa: z.string().optional().describe("nome ou id da etapa (precisa da vaga)"),
  situacao: z.enum(SITUACOES).optional().describe("ativa (padrão), reprovada, desistiu, contratada, encerrada_vaga ou todas"),
  sinalizadas: z.boolean().optional().describe("true: só as que têm resposta diferente do requisito declarado"),
  paradas: z.boolean().optional().describe("true: só as em andamento sem mudar de etapa há dias (padrão 7)"),
  dias_parada: z.number().int().min(1).max(365).optional().describe("quantos dias sem mudar de etapa contam como parada"),
  pendentes_minhas: z.boolean().optional().describe("true: só as que esperam a sua avaliação na etapa atual"),
  ordem: z.enum(["chegada", "movimentacao"]).optional().describe("chegada (padrão) ou movimentacao (movidas por último primeiro)"),
};
type FiltrosArgs = { [K in keyof typeof filtrosArgs]?: z.infer<(typeof filtrosArgs)[K]> };

// Converte os filtros ditos na conversa (nomes) nos filtros do domínio (ids).
async function filtros(ctx: ToolContext, a: FiltrosArgs): Promise<FiltrosCandidaturas> {
  const f: FiltrosCandidaturas = {};
  if (a.vaga) {
    const v = await acharVaga(ctx, a.vaga);
    if (!v) throw new DomainError("vaga_nao_encontrada", 404);
    f.vaga_id = v.id;
    if (a.etapa) f.etapa_id = acharEtapa(await getJob(ctx, v.id), a.etapa).id;
  } else if (a.etapa) {
    throw new DomainError("etapa_nao_encontrada", 404);
  }
  if (a.situacao) f.situacao = a.situacao;
  if (a.sinalizadas !== undefined) f.sinalizada = a.sinalizadas;
  if (a.paradas) f.parada_desde = new Date(Date.now() - (a.dias_parada ?? FILTRO_PARADAS_DIAS) * 86_400_000).toISOString();
  if (a.pendentes_minhas && ctx.ator.membroId) f.pendente_de = ctx.ator.membroId;
  if (a.ordem) f.ordem = a.ordem;
  return f;
}

const candidaturaArgs = z.object({
  candidatura: z.string().describe("id da candidatura ou nome da pessoa"),
  vaga: z.string().optional().describe("título ou id da vaga, para desempatar nomes"),
});

export function registrarConsultasDeCandidatura(server: McpServer, ctx: ToolContext): void {
  consulta(
    server, ctx, "listar_candidaturas",
    async (a) => {
      const inicio = lerCursor(a.cursor);
      const r = await listApplications(ctx, await filtros(ctx, a), { inicio, limite: LISTA_PADRAO });
      return {
        itens: r.itens,
        proximo_cursor: proximoCursor(inicio, LISTA_PADRAO, r.mais),
        ...(!r.itens.length && !inicio ? { mensagem: copy.funil.vazio } : {}),
      };
    },
    z.object({ ...filtrosArgs, cursor: z.string().optional().describe("proximo_cursor da página anterior") }),
  );

  consulta(
    server, ctx, "buscar_candidaturas",
    async (a) => {
      const inicio = lerCursor(a.cursor);
      const f = await filtros(ctx, { vaga: a.vaga, situacao: a.situacao ?? "todas" });
      const r = await listApplications(ctx, { ...f, q: a.texto }, { inicio, limite: LISTA_PADRAO });
      return {
        itens: r.itens,
        proximo_cursor: proximoCursor(inicio, LISTA_PADRAO, r.mais),
        ...(!r.itens.length && !inicio ? { mensagem: copy.funil.vazio } : {}),
      };
    },
    z.object({
      texto: z.string().min(1).max(200).describe("palavras a buscar; aceita \"frase exata\" e -palavra"),
      vaga: filtrosArgs.vaga,
      situacao: z.enum(SITUACOES).optional().describe("padrão: todas"),
      cursor: z.string().optional().describe("proximo_cursor da página anterior"),
    }),
  );

  consulta(
    server, ctx, "ver_candidatura",
    async (a) => {
      const { respostas, ...c } = await getApplication(ctx, await acharCandidatura(ctx, a.candidatura, a.vaga));
      return { candidatura: c, conteudo_do_candidato: { aviso: copy.funil.conteudoDoCandidato, respostas } };
    },
    candidaturaArgs,
  );

  consulta(
    server, ctx, "ler_curriculo",
    async (a) => {
      const r = await readResume(ctx, await acharCandidatura(ctx, a.candidatura, a.vaga));
      if (!r.curriculo) return { candidatura_id: r.candidatura_id, curriculo: null, aviso: r.aviso };
      const { texto, ...meta } = r.curriculo;
      return {
        candidatura_id: r.candidatura_id,
        curriculo: meta,
        conteudo_do_candidato: { aviso: copy.funil.conteudoDoCandidato, texto: texto ?? "" },
        ...("aviso" in r && r.aviso ? { aviso: r.aviso } : {}),
      };
    },
    candidaturaArgs,
  );

  consulta(server, ctx, "historico_da_candidatura", async (a) => history(ctx, await acharCandidatura(ctx, a.candidatura, a.vaga)), candidaturaArgs);

  consulta(
    server, ctx, "exportar_candidaturas",
    async (a) => {
      const { vaga_id, ...f } = await filtros(ctx, a);
      const r = await exportApplications(ctx, vaga_id!, f);
      return { ...r, mensagem: copy.funil.exportada(r.n) };
    },
    z.object({ ...filtrosArgs, vaga: z.string().describe("título da vaga (ou parte dele) ou o id") }),
    "recrutador",
  );

  consulta(
    server, ctx, "listar_propostas",
    async (a) => {
      const itens = await listProposals(ctx, { status: a.status ?? "pendente" });
      return { itens, ...(!itens.length ? { mensagem: copy.mcp.form.propostas.vazio } : {}) };
    },
    z.object({ status: z.enum(["pendente", "confirmada", "descartada", "expirada"]).optional().describe("padrão: pendente") }),
    "recrutador",
  );

  consulta(server, ctx, "listar_modelos_mensagem", async () => ({ itens: await listTemplates(ctx.empresa.id) }));
}
