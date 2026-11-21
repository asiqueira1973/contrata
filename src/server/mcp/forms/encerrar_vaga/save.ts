// salvar_encerrar_vaga (8.3; 12.1): encerra pelo domínio, com o motivo e a confirmação marcada.
// Com candidatura ativa, o banco recusa (vaga_com_ativas): é decisão (11.7, épico 8.6).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { getJob, transitionJob } from "@/server/recruiting/jobs";
import type { ContextoFormulario } from "../registrar";
import type { schemaEncerrar } from "./index";

export async function gravarEncerramento(dados: z.infer<typeof schemaEncerrar>, ctx: ContextoFormulario) {
  if (dados.confirmar !== true) throw new CamposInvalidos([{ campo: "confirmar", codigo: "campo_invalido" }]);
  await transitionJob(ctx, dados.vaga, "encerrada", dados.motivo);
  const v = await getJob(ctx, dados.vaga);
  return { ok: true as const, ids: [v.id], resumo: copy.mcp.form.encerrar_vaga.resumo(v.titulo) };
}
