// Entrega dos webhooks — regras 11.17 e 12.4 (épico 8.8; como no Assina). As entregas nascem no
// banco junto com o evento (trigger rs_tg_eventos_webhook). Aqui:
// - deliverOne: reserva (rs_fn_reserva_entrega: um envio por vez, conta a tentativa), POST JSON pelo
//   fetch protegido contra SSRF (10 s, sem seguir redirecionamento), cabeçalhos X-Contrata-Assinatura
//   (t={unix},v1={hmac_sha256(segredo, t + "." + corpo)}), X-Contrata-Evento e X-Contrata-Entrega;
//   2xx é entregue; senão a próxima tentativa fica em 1 min, 10 min, 1 h e depois 1 por dia, até 8
//   tentativas ou 3 dias (rs_fn_resultado_entrega).
// - deliverDue: as vencidas (de uma empresa, depois de cada escrita dela, ou de todas, na faxina);
// - sendTest: "Enviar teste" do formulário (não grava entrega).
// Nada de URL, segredo ou corpo em log: só o código do erro.
import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  WEBHOOK_DESISTE_DIAS, WEBHOOK_LOTE, WEBHOOK_RESPOSTA_MAX, WEBHOOK_RETENTATIVAS_S, WEBHOOK_TENTATIVAS, WEBHOOK_TIMEOUT_MS,
} from "@/lib/limits";
import { decryptSecret } from "@/server/crypto/aes";
import { db } from "@/server/db/client";
import { afterResponse } from "@/server/email/outbox";
import { errorCode } from "@/server/error-code";
import { fetchRemote } from "@/server/files/fetch-remote";

export const PREFIXO_SEGREDO = "whsec_";

// Segredo novo do webhook. Devolve: o valor em claro (vai cifrado para o banco e aparece uma vez).
export function generateWebhookSecret(): string {
  return PREFIXO_SEGREDO + randomBytes(32).toString("base64url");
}

// Assinatura da regra 11.17. Recebe: segredo, epoch em segundos e o corpo exato enviado. Devolve:
// o valor do cabeçalho X-Contrata-Assinatura.
export function signatureHeader(secret: string, epoch: number, body: string): string {
  return `t=${epoch},v1=${createHmac("sha256", secret).update(`${epoch}.${body}`).digest("hex")}`;
}

// Faz o POST. Recebe: URL, segredo, id da entrega, tipo e corpo. Devolve: o status HTTP (0 sem resposta).
async function post(url: string, secret: string, entregaId: string, tipo: string, body: string): Promise<number> {
  const epoch = Math.floor(Date.now() / 1000);
  try {
    const res = await fetchRemote(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-contrata-assinatura": signatureHeader(secret, epoch, body),
        "x-contrata-evento": tipo,
        "x-contrata-entrega": entregaId,
      },
      body,
      maxBytes: WEBHOOK_RESPOSTA_MAX,
      excess: "cortar", // 11.17: sucesso é 2xx, qualquer que seja o tamanho da resposta
      timeoutMs: WEBHOOK_TIMEOUT_MS,
      maxRedirects: 0,
    });
    return res.status;
  } catch (e) {
    console.error("webhook_falhou", errorCode(e));
    return 0;
  }
}

// Espera até a próxima tentativa, pelo número de tentativas já feitas (1 → 1 min, 2 → 10 min…).
function espera(tentativas: number): string {
  const s = WEBHOOK_RETENTATIVAS_S[Math.min(Math.max(tentativas, 1), WEBHOOK_RETENTATIVAS_S.length) - 1];
  return `${s} seconds`;
}

// Entrega uma da fila. Devolve: "entregue", "falhou", "desistiu" ou "pulada" (reservada por outro,
// ainda não venceu, webhook desligado, empresa suspensa).
export async function deliverOne(entregaId: string): Promise<"entregue" | "falhou" | "desistiu" | "pulada"> {
  const { data: d, error } = await db().from("rs_entregas_webhook")
    .select("id, tipo, corpo, webhook:webhook_id(url, segredo_cifrado, ativo), empresa:empresa_id(excluida_em, suspensa_em)")
    .eq("id", entregaId).maybeSingle();
  if (error) throw error;
  type Linha = { id: string; tipo: string; corpo: unknown; webhook: { url: string; segredo_cifrado: string; ativo: boolean } | null;
    empresa: { excluida_em: string | null; suspensa_em: string | null } | null };
  const e = d as unknown as Linha | null;
  if (!e?.webhook?.ativo || !e.empresa || e.empresa.excluida_em || e.empresa.suspensa_em) return "pulada";
  const { data: reservou, error: e2 } = await db().rpc("rs_fn_reserva_entrega", { p_id: entregaId, p_max: WEBHOOK_TENTATIVAS });
  if (e2) throw e2;
  if (!reservou) return "pulada";
  const status = await post(e.webhook.url, decryptSecret(e.webhook.segredo_cifrado), e.id, e.tipo, JSON.stringify(e.corpo));
  const { data: t } = await db().from("rs_entregas_webhook").select("tentativas").eq("id", entregaId).single();
  const { data: final, error: e3 } = await db().rpc("rs_fn_resultado_entrega", {
    p_id: entregaId, p_status_http: status, p_espera: espera(t?.tentativas ?? 1), p_max: WEBHOOK_TENTATIVAS, p_desiste: `${WEBHOOK_DESISTE_DIAS} days`,
  });
  if (e3) throw e3;
  return final as "entregue" | "falhou" | "desistiu";
}

// Entrega as vencidas (pendentes e que falharam, na hora delas). Recebe: a empresa (ou nenhuma, na
// faxina) e o lote. Devolve: quantas foram entregues. Nunca lança.
export async function deliverDue(empresaId?: string, lote = WEBHOOK_LOTE): Promise<number> {
  try {
    // "Vencida" pelo relógio do banco (o do servidor pode estar atrás).
    const { data, error } = await db().rpc("rs_fn_entregas_vencidas", { p_empresa: (empresaId ?? null) as never, p_lote: lote });
    if (error) throw error;
    let entregues = 0;
    for (const id of (data ?? []) as string[]) if ((await deliverOne(id)) === "entregue") entregues++;
    return entregues;
  } catch (e) {
    console.error("webhook_falhou", errorCode(e));
    return 0;
  }
}

// Agenda deliverDue da empresa para depois da resposta (toda escrita dela pode ter gerado evento).
export function deliverDueLater(empresaId: string): void {
  void afterResponse(async () => {
    await deliverDue(empresaId);
  });
}

// Faxina (11.17): desiste das pendentes velhas (webhook desligado, empresa suspensa) e entrega as
// vencidas de todas as empresas. Recebe: o lote. Devolve: entregues e desistidas.
export async function retryWebhooks(lote: number): Promise<{ entregues: number; desistiu: number }> {
  const { data, error } = await db().rpc("rs_fn_desiste_entregas", { p_desiste: `${WEBHOOK_DESISTE_DIAS} days` });
  if (error) throw error;
  return { entregues: await deliverDue(undefined, lote), desistiu: data ?? 0 };
}

// "Enviar teste": um POST assinado com o tipo "teste", sem gravar entrega. Recebe: URL e segredo
// cifrado. Devolve: o status HTTP (0 sem resposta).
export async function sendTest(url: string, segredoCifrado: string, empresaId: string): Promise<number> {
  const body = JSON.stringify({ id: randomUUID(), tipo: "teste", criado_em: new Date().toISOString(), empresa_id: empresaId, dados: {} });
  return post(url, decryptSecret(segredoCifrado), randomUUID(), "teste", body);
}
