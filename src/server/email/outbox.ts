// Fila de e-mail idempotente (rs_notificacoes, seção 7.3) — como no Assina: grava a notificação
// com uma chave única e tenta enviar logo depois da resposta; o que falhar fica "falhou" e a faxina
// diária retenta (8.10); na 5ª falha vira "descartada" (12.4). Chave repetida não grava nem envia
// de novo. O nome do remetente fica na linha (remetente_nome) para a retentativa.
// Seção 20.3 (decisão de 20/11/2026): o corpo (html e texto) carrega links com token em claro
// (/convite/…, /c/…), então é apagado assim que o e-mail sai. Só fica enquanto precisa ser
// reenviado (pendente ou falhou).
import "server-only";
import { after } from "next/server";
import { NOTIFICACAO_GUARDA_DIAS, NOTIFICACAO_TENTATIVAS } from "@/lib/limits";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { errorCode } from "@/server/error-code";
import { mailer } from "./mailer";

type Tipo = Database["public"]["Enums"]["rs_tipo_notificacao"];
export type NovaNotificacao = {
  // Sem empresa: alerta da instância ao ADMIN_EMAIL (v0.4.13).
  empresaId?: string;
  candidaturaId?: string;
  tipo: Tipo;
  destinatario: string;
  chave: string;
  assunto: string;
  html: string;
  texto: string;
  replyTo?: string;
  fromName?: string;
};

// Envia uma notificação já gravada e marca o resultado. Nunca lança: o erro vira status "falhou"
// com só o código (sem dado pessoal, 20.2).
export async function deliver(id: string, fromName?: string): Promise<void> {
  const { data: n, error } = await db().from("rs_notificacoes").select("*").eq("id", id).maybeSingle();
  if (error || !n || n.status === "enviada" || n.status === "descartada") return;
  try {
    const sent = await mailer().send({ to: n.destinatario, fromName: fromName ?? n.remetente_nome ?? undefined, replyTo: n.reply_to ?? undefined, subject: n.assunto, html: n.html, text: n.texto });
    // Enviado: o corpo sai do banco na mesma escrita que marca o envio (20.3).
    await db()
      .from("rs_notificacoes")
      .update({ status: "enviada", enviada_em: new Date().toISOString(), resend_id: sent.id, tentativas: n.tentativas + 1, html: "", texto: "" })
      .eq("id", id);
  } catch (e) {
    // Na última tentativa, desiste e apaga o corpo (leva link com token, 20.3).
    const desiste = n.tentativas + 1 >= NOTIFICACAO_TENTATIVAS;
    await db().from("rs_notificacoes")
      .update({ status: desiste ? "descartada" : "falhou", ultimo_erro: errorCode(e), tentativas: n.tentativas + 1, ...(desiste ? { html: "", texto: "" } : {}) })
      .eq("id", id);
  }
}

// Faxina (12.4; 8.10): retenta as que falharam e as pendentes que o envio logo depois da resposta
// perdeu, no prazo dado. Recebe: lote e prazo em ms. Devolve: quantas foram tentadas.
export async function retryNotifications(lote: number, prazoMs: number): Promise<number> {
  const limite = Date.now() + prazoMs;
  const { data, error } = await db().rpc("rs_fn_notificacoes_a_retentar", { p_lote: lote, p_max: NOTIFICACAO_TENTATIVAS });
  if (error) throw error;
  let n = 0;
  for (const id of (data ?? []) as string[]) {
    if (Date.now() > limite) break;
    await deliver(id);
    n++;
  }
  return n;
}

// Faxina (7.4; 8.10): apaga as enviadas e descartadas com mais de 30 dias. Devolve quantas.
export async function cleanOldNotifications(lote: number): Promise<number> {
  const { data, error } = await db().rpc("rs_fn_limpa_notificacoes", { p_dias: NOTIFICACAO_GUARDA_DIAS, p_lote: lote });
  if (error) throw error;
  return data ?? 0;
}

// Roda depois da resposta (after do Next); fora de uma requisição (testes, scripts), roda já.
export function afterResponse(task: () => Promise<void>): Promise<void> | void {
  try {
    after(task);
  } catch {
    return task();
  }
}

// Grava a notificação (idempotente pela chave) e agenda o envio. Devolve: o id, ou null se a
// chave já existia (nada é enviado de novo).
export async function enqueue(n: NovaNotificacao): Promise<string | null> {
  const { data, error } = await db()
    .from("rs_notificacoes")
    .upsert(
      {
        empresa_id: n.empresaId ?? null,
        candidatura_id: n.candidaturaId ?? null,
        tipo: n.tipo,
        destinatario: n.destinatario,
        chave_idempotencia: n.chave,
        assunto: n.assunto,
        html: n.html,
        texto: n.texto,
        reply_to: n.replyTo ?? null,
        remetente_nome: n.fromName ?? null,
      },
      { onConflict: "chave_idempotencia", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await afterResponse(() => deliver(data.id, n.fromName));
  return data.id;
}

// Agenda o envio de uma notificação que o banco já gravou na mesma transação da mudança (ex.:
// rs_fn_conclui_candidatura, rs_fn_encerra_candidatura). Recebe: id e o nome do remetente.
export async function deliverLater(id: string, fromName?: string): Promise<void> {
  // O banco não sabe o nome do remetente: fica na linha para a retentativa da faxina.
  if (fromName) await db().from("rs_notificacoes").update({ remetente_nome: fromName }).eq("id", id);
  await afterResponse(() => deliver(id, fromName));
}
