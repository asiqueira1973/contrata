// salvar_resposta_revisao / registrar_resposta_revisao (8.6; 11.13): manda a resposta e, se pedido
// (e a conexão tiver o escopo decisao), reabre na mesma transação.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { DomainError } from "@/server/http";
import { getApplication } from "@/server/recruiting/pipeline";
import { respondReview } from "@/server/recruiting/messages";
import type { ContextoFormulario } from "../registrar";
import type { schemaRespostaRevisao } from "./index";

export async function gravarRespostaRevisao(dados: z.infer<typeof schemaRespostaRevisao>, ctx: ContextoFormulario) {
  if (dados.reabrir && !ctx.escopos.includes("decisao")) throw new DomainError("escopo_insuficiente", 403);
  const d = await getApplication(ctx, dados.candidatura);
  await respondReview(ctx, dados.candidatura, { assunto: dados.assunto, corpo: dados.corpo }, dados.reabrir === true);
  return { ok: true as const, ids: [], resumo: copy.mcp.form.resposta_revisao.resumo(d.pessoa.nome, dados.reabrir === true) };
}
