// salvar_avaliacao (8.5; 11.9): grava a avaliação de quem clicou (o ator é o membro, origem
// formulario). O banco recusa quem não está na equipe da vaga, candidatura que não está em
// andamento e etapa de outra vaga.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { getApplication, registerEvaluation } from "@/server/recruiting/pipeline";
import type { ContextoFormulario } from "../registrar";
import type { schemaAvaliacao } from "./index";

export async function gravarAvaliacao(dados: z.infer<typeof schemaAvaliacao>, ctx: ContextoFormulario) {
  const { id } = await registerEvaluation(ctx, dados);
  const d = await getApplication(ctx, dados.candidatura);
  const etapa = d.avaliacoes.find((a) => a.membro_id === ctx.membro.id && a.etapa_id === dados.etapa)?.etapa ?? "";
  return { ok: true as const, ids: [id], resumo: copy.mcp.form.avaliacao.resumo(d.pessoa.nome, etapa) };
}
