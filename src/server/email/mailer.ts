// Envio de e-mail — seção 4 (Resend). Interface única com dois drivers, como no Assina:
// - resend: API do Resend por fetch, quando RESEND_API_KEY existe;
// - local: grava cada e-mail em .caixa-de-saida-local/ (fora do git), só fora de produção.
// Em produção sem chave o app falha alto. Os testes trocam o driver com setMailerForTests().
// Nunca registra destinatário, assunto nem corpo em log (seção 20.2).
import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NOME_PRODUTO } from "@/lib/copy";
import { EMAIL_TIMEOUT_MS } from "@/lib/limits";

export type EmailMessage = {
  to: string;
  /** Nome da empresa ("{Empresa} via Contrata", 15.4); ausente nos e-mails da própria instância. */
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export interface Mailer {
  /** Envia e devolve o id do provedor. Lança erro se o provedor recusar ou não responder. */
  send(message: EmailMessage): Promise<{ id: string }>;
}

// Remetente (15.4): "{empresa} via Contrata" <EMAIL_REMETENTE>. O nome vai entre aspas, sem aspas,
// barras, quebras de linha nem caracteres de controle (um nome com vírgula quebraria o cabeçalho).
export function fromHeader(name?: string): string {
  const address = process.env.EMAIL_REMETENTE || "naoresponda@localhost";
  if (name === undefined) return `"${NOME_PRODUTO}" <${address}>`;
  const safe = name.replace(/[\x00-\x1f\x7f"\\<>]/g, " ").replace(/\s+/g, " ").trim() || NOME_PRODUTO;
  return `"${safe} via ${NOME_PRODUTO}" <${address}>`;
}

// Driver Resend (POST /emails). Recebe: a chave. Devolve: Mailer.
function resendMailer(apiKey: string): Mailer {
  return {
    async send(m) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from: fromHeader(m.fromName), to: [m.to], reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`resend_${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { id: body.id ?? "" };
    },
  };
}

// Driver local (dev): cada e-mail vira um .html e um .txt em .caixa-de-saida-local/.
function localMailer(): Mailer {
  return {
    async send(m) {
      const dir = join(process.cwd(), ".caixa-de-saida-local");
      await mkdir(dir, { recursive: true });
      const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
      const header = `De: ${fromHeader(m.fromName)}\nPara: ${m.to}\nResponder para: ${m.replyTo ?? "-"}\nAssunto: ${m.subject}\n\n`;
      await writeFile(join(dir, `${id}.txt`), header + m.text);
      await writeFile(join(dir, `${id}.html`), `<!-- ${header.replace(/--/g, "- -")} -->\n${m.html}`);
      return { id: `local-${id}` };
    },
  };
}

let override: Mailer | null = null;
let cached: Mailer | null = null;

// Escolhe o driver. Devolve: o Mailer do processo.
export function mailer(): Mailer {
  if (override) return override;
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (key) cached = resendMailer(key);
  else if (process.env.NODE_ENV !== "production") cached = localMailer();
  else throw new Error("RESEND_API_KEY ausente");
  return cached;
}

// Só para testes: troca o driver (null volta ao normal).
export function setMailerForTests(m: Mailer | null): void {
  override = m;
}
