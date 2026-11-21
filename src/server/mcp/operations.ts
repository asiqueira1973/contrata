// Operações diretas do agente (8.5; classe O, 11.34 e assunção 24.14): mover_etapa e adicionar_nota.
// Gravam sem formulário porque são reversíveis e não decidem sobre a pessoa; exigem escopo escrita
// e papel ≥ recrutador, e ficam na trilha como "{cliente} · em nome de {membro}" (o ator é o agente
// do token, origem mcp). O banco confere de novo alcance, lote e situação.
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import { DECISOES_LOTE_MAX, LISTA_MAX, MOVER_LOTE_MAX, NOTA_MAX, type Escopo } from "@/lib/limits";
import { errorCode } from "@/server/error-code";
import { DomainError } from "@/server/http";
import { MOTIVOS_ENCERRAMENTO, MOTIVOS_REPROVACAO, proposeDecision } from "@/server/recruiting/decisions";
import { addNote, listApplications, moveStage } from "@/server/recruiting/pipeline";
import { acharCandidatura, acharEtapa, vagaDaCandidatura } from "./candidaturas";
import { acharPorNome } from "./forms/comum";
import { bloqueio, erro, resposta, type ToolContext } from "./kit";
import { acharVaga } from "./vagas";

type Resultado = { texto: string; estrutura: Record<string, unknown> };

// Registra uma operação: escrita, recrutador ou mais, visível ao modelo. Erro de regra vira a
// mensagem da copy; o resto, a genérica (sem dado pessoal no log, 20.2).
function operacao<E extends z.ZodObject>(server: McpServer, ctx: ToolContext, nome: string, entrada: E, fn: (args: z.infer<E>) => Promise<Resultado>, escopo: Escopo = "escrita") {
  if (bloqueio(ctx, escopo, "recrutador")) return;
  server.registerTool(
    nome,
    { title: copy.mcp.titulos[nome], description: copy.mcp.descricoes[nome], inputSchema: entrada as unknown as z.ZodObject<z.ZodRawShape>, _meta: { ui: { visibility: ["model"] } } },
    async (args: unknown) => {
      const b = bloqueio(ctx, escopo, "recrutador");
      if (b) return erro(b);
      try {
        const r = await fn(args as z.infer<E>);
        return resposta(r.estrutura, r.texto);
      } catch (e) {
        const codigo = e instanceof DomainError ? e.codigo : errorCode(e);
        if (codigo in ERROS) return erro(codigo);
        console.error("erro_interno_mcp", codigo);
        return erro("generico");
      }
    },
  );
}

// Ids ou nomes de pessoas → ids. Nomes são procurados uma vez só, entre as candidaturas em
// andamento da vaga (se dada) no alcance; nome ambíguo ou ausente recusa o lote inteiro.
async function idsDasCandidaturas(ctx: ToolContext, textos: string[], vaga?: string): Promise<string[]> {
  const ehId = (s: string) => z.uuid().safeParse(s.trim()).success;
  const nomes = textos.filter((t) => !ehId(t));
  if (!nomes.length) return textos.map((t) => t.trim());
  if (nomes.length === 1 && textos.length === 1) return [await acharCandidatura(ctx, nomes[0], vaga)];
  let vagaId: string | undefined;
  if (vaga) {
    const v = await acharVaga(ctx, vaga);
    if (!v) throw new DomainError("vaga_nao_encontrada", 404);
    vagaId = v.id;
  }
  const { itens } = await listApplications(ctx, { situacao: "ativa", ...(vagaId ? { vaga_id: vagaId } : {}) }, { inicio: 0, limite: LISTA_MAX });
  return textos.map((t) => {
    if (ehId(t)) return t.trim();
    const achada = acharPorNome(itens, t);
    if (!achada) throw new DomainError("candidatura_nao_encontrada", 404);
    return achada.id;
  });
}

export function registrarOperacoes(server: McpServer, ctx: ToolContext): void {
  operacao(
    server, ctx, "mover_etapa",
    z.object({
      candidaturas: z.array(z.string().min(1)).min(1).max(MOVER_LOTE_MAX).describe("ids das candidaturas (ou nomes das pessoas), de 1 a 100, todas da mesma vaga"),
      etapa: z.string().min(1).describe("nome ou id da etapa de destino"),
      vaga: z.string().optional().describe("título ou id da vaga, para desempatar nomes"),
    }),
    async (a) => {
      const ids = await idsDasCandidaturas(ctx, a.candidaturas, a.vaga);
      const vaga = await vagaDaCandidatura(ctx, ids[0]);
      const etapa = acharEtapa(vaga, a.etapa);
      const r = await moveStage(ctx, ids, etapa.id);
      return {
        texto: r.movidas ? copy.funil.movidas(r.movidas, r.etapa) : copy.funil.nenhumaMovida(r.etapa),
        estrutura: { movidas: r.movidas, etapa: { id: etapa.id, nome: r.etapa }, candidaturas: ids },
      };
    },
  );

  operacao(
    server, ctx, "adicionar_nota",
    z.object({
      candidatura: z.string().min(1).describe("id da candidatura ou nome da pessoa"),
      texto: z.string().min(1).max(NOTA_MAX).describe("a nota, só com fatos do processo"),
      vaga: z.string().optional().describe("título ou id da vaga, para desempatar nomes"),
    }),
    async (a) => {
      const id = await acharCandidatura(ctx, a.candidatura, a.vaga);
      const r = await addNote(ctx, id, a.texto);
      return { texto: copy.funil.notaAdicionada, estrutura: { candidatura_id: id, nota_id: r.id } };
    },
  );

  // propor_decisao (11.7, 13.3): só para cliente SEM formulário. Cria proposta pendente; quem
  // confirma é uma pessoa no formulário de propostas. Escopo decisao, recrutador+.
  if (ctx.ui !== "sim") {
    operacao(
      server, ctx, "propor_decisao",
      z.object({
        tipo: z.enum(["reprovar", "contratar", "encerrar_vaga", "enviar_mensagem"]).describe("o que propor"),
        candidaturas: z.array(z.string().min(1)).max(DECISOES_LOTE_MAX).optional().describe("ids das candidaturas (ou nomes); não vale para encerrar_vaga"),
        vaga: z.string().optional().describe("título ou id da vaga (encerrar_vaga, ou para desempatar nomes)"),
        motivo: z.enum(MOTIVOS_REPROVACAO).optional().describe("motivo interno da reprovação (não vai ao candidato)"),
        motivo_encerramento: z.enum(MOTIVOS_ENCERRAMENTO).optional(),
        devolutiva: z.string().optional().describe("texto ao candidato (reprovar e encerrar_vaga: 20 a 3.000 caracteres)"),
        mensagem: z.string().optional().describe("mensagem opcional ao contratar"),
        assunto: z.string().optional(),
        corpo: z.string().optional().describe("texto de enviar_mensagem"),
        justificativa: z.string().max(2000).optional().describe("por que você propõe (aparece para quem confirma)"),
      }),
      async (a) => {
        const payload = { motivo: a.motivo, motivo_encerramento: a.motivo_encerramento, devolutiva: a.devolutiva, mensagem: a.mensagem, assunto: a.assunto, corpo: a.corpo };
        const limpo = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
        if (a.tipo === "encerrar_vaga") {
          const v = await acharVaga(ctx, a.vaga);
          if (!v) throw new DomainError("vaga_nao_encontrada", 404);
          const r = await proposeDecision(ctx, { tipo: a.tipo, vaga: v.id, payload: limpo, justificativa: a.justificativa });
          return { texto: r.mensagem, estrutura: { decisoes: [r.decisao_id] } };
        }
        const ids = await idsDasCandidaturas(ctx, a.candidaturas ?? [], a.vaga);
        if (!ids.length) throw new DomainError("candidatura_nao_encontrada", 404);
        const criadas: string[] = [];
        for (const id of ids) criadas.push((await proposeDecision(ctx, { tipo: a.tipo, candidatura: id, payload: limpo, justificativa: a.justificativa })).decisao_id);
        return { texto: copy.decisoes.propostaCriada, estrutura: { decisoes: criadas } };
      },
      "decisao",
    );
  }
}
