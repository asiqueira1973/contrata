// salvar_publicar_vaga / registrar_publicar_vaga (8.3; 12.1): publica pelo domínio. O que falta
// pela 11.1 volta como erro geral (este formulário só tem o campo da vaga).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { getJob, transitionJob } from "@/server/recruiting/jobs";
import { enderecosDaVaga } from "../../vagas";
import type { ContextoFormulario } from "../registrar";
import type { schemaPublicar } from "./index";

export async function gravarPublicacao(dados: z.infer<typeof schemaPublicar>, ctx: ContextoFormulario) {
  try {
    await transitionJob(ctx, dados.vaga, "publicada");
  } catch (e) {
    if (e instanceof CamposInvalidos) throw new CamposInvalidos(e.campos.map((x) => ({ ...x, campo: "" })));
    throw e;
  }
  const v = await getJob(ctx, dados.vaga);
  const { url } = await enderecosDaVaga(ctx.empresa.slug, ctx.empresa.id, v.slug, true);
  return { ok: true as const, ids: [v.id], resumo: copy.mcp.form.publicar_vaga.resumo(v.titulo, url) };
}
