// salvar_modelos_mensagem / registrar_modelos_mensagem (8.6; 11.29): salva o personalizado (ou o
// modelo novo) ou volta ao padrão; o resumo leva a prévia com dados fictícios.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { getTemplate } from "@/server/messages/templates";
import { previewTemplate, resetTemplate, saveTemplate } from "@/server/recruiting/messages";
import type { ContextoFormulario } from "../registrar";
import type { schemaModelo } from "./index";

const c = copy.mcp.form.modelos_mensagem;

export async function gravarModelo(dados: z.infer<typeof schemaModelo>, ctx: ContextoFormulario) {
  if (dados.operacao === "padrao") {
    const m = dados.modelo ? await getTemplate(ctx.empresa.id, dados.modelo) : null;
    if (!m) throw new CamposInvalidos([{ campo: "modelo", codigo: "modelo_nao_encontrado" }]);
    await resetTemplate(ctx.empresa.id, m.chave);
    return { ok: true as const, ids: [], resumo: c.resumoPadrao(m.nome) };
  }
  const chave = dados.operacao === "criar" ? dados.chave : dados.modelo;
  const salvo = await saveTemplate(ctx.empresa.id, { chave, nome: dados.nome, assunto: dados.assunto, corpo: dados.corpo });
  const p = previewTemplate(ctx.empresa, salvo);
  return { ok: true as const, ids: [], resumo: `${c.resumoSalvo(salvo.nome)} ${c.previa(p.assunto, p.corpo)}` };
}
