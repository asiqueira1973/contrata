// "Pedir acesso" do resumo semanal (8.10; 11.31): o dono de vaga sem acesso clica no e-mail, confirma
// na página e os administradores recebem o pedido. Não cria convite. O link leva um token HMAC
// (pessoa, empresa e validade) com SESSION_SECRET; sem conta, sem cookie.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { FUSO, PEDIR_ACESSO_DIAS } from "@/lib/limits";
import { db } from "@/server/db/client";
import { enqueue } from "@/server/email/outbox";
import { acessoPedido } from "@/server/email/templates";
import { DomainError } from "@/server/http";
import { siteOrigin } from "@/server/oauth/server";

// O segredo do HMAC (o mesmo da sessão; o prefixo "pedir_acesso:" separa os usos).
function segredo(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET ausente");
  return s;
}
// Assinatura do token: empresa, pessoa e validade.
const assina = (empresaId: string, pessoaId: string, exp: number) =>
  createHmac("sha256", segredo()).update(`pedir_acesso:${empresaId}:${pessoaId}:${exp}`).digest("base64url");

// Link do botão "Pedir acesso". Recebe: slug, empresa, pessoa e o momento. Devolve a URL.
export function linkPedirAcesso(slug: string, empresaId: string, pessoaId: string, agora = new Date()): string {
  const exp = Math.floor(agora.getTime() / 1000) + PEDIR_ACESSO_DIAS * 86_400;
  return `${siteOrigin()}/${slug}/pedir-acesso?t=${pessoaId}.${exp}.${assina(empresaId, pessoaId, exp)}`;
}

// Confere o token. Devolve o id da pessoa ou null (formato, assinatura ou prazo errados).
export function lerTokenPedirAcesso(empresaId: string, token: unknown): string | null {
  if (typeof token !== "string") return null;
  const m = /^([0-9a-f-]{36})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return null;
  const exp = Number(m[2]);
  if (exp * 1000 < Date.now()) return null;
  const esperado = Buffer.from(assina(empresaId, m[1], exp));
  const dado = Buffer.from(m[3]);
  return esperado.length === dado.length && timingSafeEqual(esperado, dado) ? m[1] : null;
}

// Registra o pedido (acesso_pedido) e avisa os administradores, uma vez por pessoa por dia.
// Recebe: empresa e token. Lança link_pedir_acesso_invalido.
export async function requestAccess(empresa: { id: string; nome: string }, token: unknown): Promise<void> {
  const pessoa = lerTokenPedirAcesso(empresa.id, token);
  if (!pessoa) throw new DomainError("link_pedir_acesso_invalido", 404);
  const { data, error } = await db().rpc("rs_fn_pede_acesso", { p_empresa: empresa.id, p_pessoa: pessoa });
  if (error?.message === "nao_encontrado") throw new DomainError("link_pedir_acesso_invalido", 404);
  if (error) throw error;
  const r = data as { nome: string; administradores: { id: string; email: string }[] };
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
  const m = acessoPedido({ empresa: empresa.nome, nome: r.nome });
  for (const a of r.administradores) {
    await enqueue({ empresaId: empresa.id, tipo: "acesso_pedido", destinatario: a.email, chave: `acesso_pedido:${pessoa}:${dia}:${a.id}`,
      assunto: m.assunto, html: m.html, texto: m.texto });
  }
}
