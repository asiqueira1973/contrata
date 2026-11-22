// salvar_convidar_para_vaga / registrar_convidar_para_vaga (8.7): manda os convites (o banco confere
// consentimento, prazo, alcance e vaga publicada) e diz quantos foram e quantos já eram candidatos.
import "server-only";
import type { z } from "zod";
import { inviteTalents } from "@/server/recruiting/talents";
import type { ContextoFormulario } from "../registrar";
import type { schemaConvites } from "./index";

export async function gravarConvites(dados: z.infer<typeof schemaConvites>, ctx: ContextoFormulario) {
  const r = await inviteTalents(ctx, { candidatos: dados.candidatos, vaga: dados.vaga, texto: { assunto: dados.assunto, corpo: dados.corpo } });
  return { ok: true as const, ids: [], resumo: r.resumo };
}
