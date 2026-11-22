// salvar_webhooks (8.8): cria, edita, remove, gera segredo novo ou envia teste. O segredo vai só em
// `segredo`, que o formulário mostra uma vez; o resumo (texto que o modelo lê) nunca o leva. Ao
// editar, endereço igual ao atual não conta como troca.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { createWebhook, listWebhooks, removeWebhook, testWebhook, updateWebhook } from "@/server/webhooks/settings";
import type { ContextoFormulario } from "../registrar";
import type { schemaWebhooks } from "./index";

// Só o host do endereço (o que aparece nos resumos e na trilha).
export function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function gravarWebhooks(dados: z.infer<typeof schemaWebhooks>, ctx: ContextoFormulario) {
  const c = copy.mcp.form.webhooks;
  if (dados.operacao === "criar") {
    const w = await createWebhook(ctx, { url: dados.url ?? "", eventos: dados.eventos ?? [], ativo: dados.ativo ?? true });
    const host = hostDe(dados.url ?? "");
    return { ok: true as const, ids: [w.id], resumo: c.resumoCriado(host), segredo: { rotulo: c.segredoRotulo, valor: w.segredo, aviso: c.segredoAviso } };
  }
  if (!dados.webhook) throw new CamposInvalidos([{ campo: "webhook", codigo: "campo_obrigatorio" }]);
  const atual = (await listWebhooks(ctx)).find((w) => w.id === dados.webhook);
  const host = hostDe(atual?.url ?? "");
  if (dados.operacao === "remover") {
    await removeWebhook(ctx, dados.webhook);
    return { ok: true as const, ids: [dados.webhook], resumo: c.resumoRemovido };
  }
  if (dados.operacao === "enviar_teste") {
    const status = await testWebhook(ctx, dados.webhook);
    return { ok: true as const, ids: [dados.webhook], resumo: c.resumoTeste(host, status) };
  }
  if (dados.operacao === "gerar_segredo") {
    const r = await updateWebhook(ctx, dados.webhook, { novoSegredo: true });
    return { ok: true as const, ids: [dados.webhook], resumo: c.resumoSegredo(host), segredo: { rotulo: c.segredoRotulo, valor: r.segredo ?? "", aviso: c.segredoAviso } };
  }
  const url = dados.url && dados.url !== atual?.url ? dados.url : undefined;
  await updateWebhook(ctx, dados.webhook, { url, eventos: dados.eventos, ativo: dados.ativo });
  return { ok: true as const, ids: [dados.webhook], resumo: c.resumoEditado(hostDe(url ?? atual?.url ?? "")) };
}
