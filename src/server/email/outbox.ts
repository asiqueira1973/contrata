// Fila de e-mail idempotente (rs_notificacoes, seção 7.3) — como no Assina: grava a notificação
// com uma chave única e tenta enviar logo depois da resposta; o que falhar fica "falhou" para a
// faxina diária retentar (8.10). Chave repetida não grava nem envia de novo.
// Seção 20.3 (decisão de 20/11/2026): o corpo (html e texto) carrega links com token em claro
// (/convite/…, /c/…), então é apagado assim que o e-mail sai. Só fica enquanto precisa ser
// reenviado (pendente ou falhou).
import "server-only";
import { after } from "next/server";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { errorCode } from "@/server/error-code";
import { mailer } from "./mailer";

type Tipo = Database["public"]["Enums"]["rs_tipo_notificacao"];
export type NovaNotificacao = {
  empresaId: string;
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
    const sent = await mailer().send({ to: n.destinatario, fromName, replyTo: n.reply_to ?? undefined, subject: n.assunto, html: n.html, text: n.texto });
    // Enviado: o corpo sai do banco na mesma escrita que marca o envio (20.3).
    await db()
      .from("rs_notificacoes")
      .update({ status: "enviada", enviada_em: new Date().toISOString(), resend_id: sent.id, tentativas: n.tentativas + 1, html: "", texto: "" })
      .eq("id", id);
  } catch (e) {
    await db().from("rs_notificacoes").update({ status: "falhou", ultimo_erro: errorCode(e), tentativas: n.tentativas + 1 }).eq("id", id);
  }
}

// Roda depois da resposta (after do Next); fora de uma requisição (testes, scripts), roda já.
function afterResponse(task: () => Promise<void>): Promise<void> | void {
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
        empresa_id: n.empresaId,
        candidatura_id: n.candidaturaId ?? null,
        tipo: n.tipo,
        destinatario: n.destinatario,
        chave_idempotencia: n.chave,
        assunto: n.assunto,
        html: n.html,
        texto: n.texto,
        reply_to: n.replyTo ?? null,
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
