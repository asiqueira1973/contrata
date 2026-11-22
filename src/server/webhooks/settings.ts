// Configuração dos webhooks — épico 8.8 (11.17, 11.18; seção 5: só administrador). Até 5 por
// empresa; URL https pública (conferida ao salvar e de novo em cada envio); eventos do catálogo
// 13.4; segredo whsec_ gerado aqui, cifrado (AES-256-GCM) no banco e devolvido em claro uma única
// vez, para o formulário mostrar. Toda consulta filtra por empresa_id; o banco confere o papel.
import "server-only";
import { EVENTOS_WEBHOOK } from "@/lib/copy";
import { WEBHOOK_URL_MAX, WEBHOOKS_POR_EMPRESA } from "@/lib/limits";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { encryptSecret } from "@/server/crypto/aes";
import { db } from "@/server/db/client";
import { isAcceptableWebhookUrl } from "@/server/files/fetch-remote";
import { CamposInvalidos, DomainError } from "@/server/http";
import { atorJson } from "@/server/org/actor";
import { generateWebhookSecret, sendTest } from "./deliver";

export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number];
export type WebhookListado = {
  id: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  criado_em: string;
  ultima_entrega: { status: string; ultimo_status_http: number | null; em: string } | null;
};

function exigeAdministrador(ctx: ContextoMembro) {
  if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
}

// Confere URL e eventos. Recebe: o que veio. Devolve: os valores limpos (ou undefined).
function confere(p: { url?: string; eventos?: string[] }) {
  const url = p.url?.trim();
  if (url !== undefined && (!url || url.length > WEBHOOK_URL_MAX || !isAcceptableWebhookUrl(url))) {
    throw new CamposInvalidos([{ campo: "url", codigo: "url_recusada" }]);
  }
  const eventos = p.eventos ? [...new Set(p.eventos)] : undefined;
  if (eventos && (!eventos.length || eventos.some((e) => !(EVENTOS_WEBHOOK as readonly string[]).includes(e)))) {
    throw new CamposInvalidos([{ campo: "eventos", codigo: "eventos_invalidos" }]);
  }
  return { url, eventos };
}

// Lista os webhooks da empresa com a última entrega de cada. Sem o segredo.
export async function listWebhooks(ctx: ContextoMembro): Promise<WebhookListado[]> {
  exigeAdministrador(ctx);
  const { data, error } = await db().from("rs_webhooks").select("id, url, eventos, ativo, criado_em")
    .eq("empresa_id", ctx.empresa.id).order("criado_em");
  if (error) throw error;
  const itens: WebhookListado[] = [];
  for (const w of data ?? []) {
    const { data: u } = await db().from("rs_entregas_webhook").select("status, ultimo_status_http, criado_em")
      .eq("empresa_id", ctx.empresa.id).eq("webhook_id", w.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    itens.push({ ...w, ultima_entrega: u ? { status: u.status, ultimo_status_http: u.ultimo_status_http, em: u.criado_em } : null });
  }
  return itens;
}

// Cria um webhook. Recebe: URL, eventos e se nasce ligado. Devolve: o id e o segredo em claro.
export async function createWebhook(ctx: ContextoMembro, p: { url: string; eventos: string[]; ativo?: boolean }) {
  exigeAdministrador(ctx);
  const { url, eventos } = confere(p);
  if (!url) throw new CamposInvalidos([{ campo: "url", codigo: "campo_obrigatorio" }]);
  if (!eventos) throw new CamposInvalidos([{ campo: "eventos", codigo: "eventos_invalidos" }]);
  const segredo = generateWebhookSecret();
  const { data, error } = await db().rpc("rs_fn_salva_webhook", {
    p_empresa: ctx.empresa.id, p_id: null as never, p_url: url, p_eventos: eventos, p_ativo: p.ativo ?? true,
    p_segredo_cifrado: encryptSecret(segredo), p_max: WEBHOOKS_POR_EMPRESA, p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  return { id: data as string, segredo };
}

// Edita um webhook: o que não vier fica como está; novoSegredo gera outro (o antigo para de valer).
// Devolve: o segredo novo, se pedido.
export async function updateWebhook(ctx: ContextoMembro, id: string, p: { url?: string; eventos?: string[]; ativo?: boolean; novoSegredo?: boolean }) {
  exigeAdministrador(ctx);
  const { url, eventos } = confere(p);
  const segredo = p.novoSegredo ? generateWebhookSecret() : null;
  const { error } = await db().rpc("rs_fn_salva_webhook", {
    p_empresa: ctx.empresa.id, p_id: id, p_url: (url ?? null) as never, p_eventos: (eventos ?? null) as never,
    p_ativo: (p.ativo ?? null) as never, p_segredo_cifrado: (segredo ? encryptSecret(segredo) : null) as never,
    p_max: WEBHOOKS_POR_EMPRESA, p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  return { segredo };
}

// Remove um webhook (as entregas dele saem junto).
export async function removeWebhook(ctx: ContextoMembro, id: string): Promise<void> {
  exigeAdministrador(ctx);
  const { error } = await db().rpc("rs_fn_remove_webhook", { p_empresa: ctx.empresa.id, p_id: id, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
}

// "Enviar teste" (8.8): POST assinado com o tipo "teste", sem gravar entrega. Devolve: o status HTTP
// (0 sem resposta).
export async function testWebhook(ctx: ContextoMembro, id: string): Promise<number> {
  exigeAdministrador(ctx);
  const { data, error } = await db().from("rs_webhooks").select("url, segredo_cifrado").eq("empresa_id", ctx.empresa.id).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new DomainError("nao_encontrado", 404);
  return sendTest(data.url, data.segredo_cifrado, ctx.empresa.id);
}
