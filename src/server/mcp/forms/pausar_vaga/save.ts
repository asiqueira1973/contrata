// salvar_pausar_vaga / registrar_pausar_vaga (8.3; 12.1): pausa pelo domínio.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { getJob, transitionJob } from "@/server/recruiting/jobs";
import type { ContextoFormulario } from "../registrar";
import type { schemaPausar } from "./index";

export async function gravarPausa(dados: z.infer<typeof schemaPausar>, ctx: ContextoFormulario) {
  await transitionJob(ctx, dados.vaga, "pausada");
  const v = await getJob(ctx, dados.vaga);
  return { ok: true as const, ids: [v.id], resumo: copy.mcp.form.pausar_vaga.resumo(v.titulo) };
}
