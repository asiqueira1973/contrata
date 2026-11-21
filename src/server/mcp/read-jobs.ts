// Consultas de vaga do MCP (8.3; classe C, 13.3): listar_vagas, ver_vaga e resumo_da_vaga.
// Sempre no alcance (11.32): recrutador limitado vê as vagas das áreas dele; avaliador, só as da
// equipe. Filtros por nome ou id; listas com cursor.
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { LISTA_PADRAO, STATUS_VAGA } from "@/lib/limits";
import { faltasParaPublicar } from "@/lib/schemas/jobs";
import { lerCursor, proximoCursor } from "@/server/api/v1";
import { DomainError } from "@/server/http";
import { listAreas } from "@/server/org/areas";
import { listPeople } from "@/server/org/people";
import { getJob, jobSummary, listJobs } from "@/server/recruiting/jobs";
import { acharPorNome } from "./forms/comum";
import type { ToolContext } from "./kit";
import { consulta } from "./read";
import { acharVaga, enderecosDaVaga } from "./vagas";

const vagaArg = z.object({ vaga: z.string().describe("título da vaga (ou parte dele) ou o id") });

export function registrarConsultasDeVaga(server: McpServer, ctx: ToolContext): void {
  consulta(
    server, ctx, "listar_vagas",
    async (a) => {
      const filtros: Parameters<typeof listJobs>[1] = {};
      if (a.status) filtros.status = a.status;
      if (a.area) {
        const area = acharPorNome(await listAreas(ctx.empresa.id), a.area);
        if (!area) return { itens: [], proximo_cursor: null, mensagem: copy.mcp.vagas.areaNaoEncontrada };
        filtros.area_id = area.id;
      }
      if (a.dono) {
        const dono = acharPorNome(await listPeople(ctx.empresa.id), a.dono);
        if (!dono) return { itens: [], proximo_cursor: null, mensagem: copy.mcp.vagas.donoNaoEncontrado };
        filtros.dono_pessoa_id = dono.id;
      }
      const inicio = lerCursor(a.cursor);
      const r = await listJobs(ctx, filtros, { inicio, limite: LISTA_PADRAO });
      const vazio = !r.itens.length && !inicio;
      return {
        itens: r.itens,
        proximo_cursor: proximoCursor(inicio, LISTA_PADRAO, r.mais),
        ...(vazio ? { mensagem: Object.keys(filtros).length ? copy.mcp.vagas.nenhumaNoFiltro : copy.mcp.vagas.vazio } : {}),
      };
    },
    z.object({
      area: z.string().optional().describe("nome da área"),
      dono: z.string().optional().describe("nome da pessoa dona da vaga"),
      status: z.enum(STATUS_VAGA).optional().describe("rascunho, publicada, pausada ou encerrada"),
      cursor: z.string().optional().describe("proximo_cursor da página anterior"),
    }),
  );

  consulta(
    server, ctx, "ver_vaga",
    async (a) => {
      const achada = await acharVaga(ctx, a.vaga);
      if (!achada) throw new DomainError("vaga_nao_encontrada", 404);
      const v = await getJob(ctx, achada.id);
      const enderecos = await enderecosDaVaga(ctx.empresa.slug, ctx.empresa.id, v.slug, v.status === "publicada");
      const faltas = v.status === "rascunho" || v.status === "pausada" ? faltasParaPublicar(v) : [];
      return { vaga: v, ...enderecos, falta_para_publicar: faltas.map((f) => f.campo) };
    },
    vagaArg,
  );

  consulta(
    server, ctx, "resumo_da_vaga",
    async (a) => {
      const achada = await acharVaga(ctx, a.vaga);
      if (!achada) throw new DomainError("vaga_nao_encontrada", 404);
      return jobSummary(ctx, achada.id);
    },
    vagaArg,
  );
}
