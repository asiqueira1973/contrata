// salvar_mensagem / registrar_mensagem (8.6; 11.8): manda a mensagem (variáveis conferidas e
// trocadas no envio; o corpo guardado não leva o link, 20.3).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { getApplication } from "@/server/recruiting/pipeline";
import { sendMessage } from "@/server/recruiting/messages";
import type { ContextoFormulario } from "../registrar";
import type { schemaMensagem } from "./index";

export async function gravarMensagem(dados: z.infer<typeof schemaMensagem>, ctx: ContextoFormulario) {
  const d = await getApplication(ctx, dados.candidatura);
  const { id } = await sendMessage(ctx, dados.candidatura, { assunto: dados.assunto, corpo: dados.corpo });
  return { ok: true as const, ids: [id], resumo: copy.mcp.form.mensagem.resumo(d.pessoa.nome) };
}
