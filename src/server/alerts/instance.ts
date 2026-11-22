// Alertas da instância ao ADMIN_EMAIL (spec 6.1, 18 e 23.1; v0.4.13) e o aviso de empresa sem
// espaço aos administradores dela (11.14). Tudo pela fila de e-mail (outbox), com chave por dia:
// no máximo um alerta de cada tipo (e de cada usuário ou empresa) por dia, e a faxina retenta o que
// falhar. ADMIN_EMAIL vazia: nenhum alerta da instância sai. Nunca lança: o fluxo que chamou segue,
// e a falha vai ao log só com o código. Nenhum dado pessoal: ids, nomes de passos, códigos e
// tamanhos (20.2).
import "server-only";
import { copy } from "@/lib/copy";
import { ALERTA_BANCO_FRACAO, ALERTA_BANCO_LIMITE_MB_PADRAO, FUSO, USO_EMPRESA_MAX_BYTES } from "@/lib/limits";
import { db } from "@/server/db/client";
import { alertaInstancia, armazenamentoCheio } from "@/server/email/templates";
import { enqueue } from "@/server/email/outbox";
import { errorCode } from "@/server/error-code";

const dia = (agora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
const destino = () => process.env.ADMIN_EMAIL?.trim() || null;

// Põe um alerta na fila. Recebe: o nome do alerta, o sufixo da chave e o e-mail montado.
// Devolve: true se gravou (false sem ADMIN_EMAIL, chave repetida ou falha).
async function enfileira(nome: string, sufixo: string, msg: { assunto: string; html: string; texto: string }): Promise<boolean> {
  const to = destino();
  if (!to) return false;
  try {
    return !!(await enqueue({ tipo: "alerta_instancia", destinatario: to, chave: `alerta:${nome}:${sufixo}`, ...msg }));
  } catch (e) {
    console.error("alerta_instancia_falhou", nome, errorCode(e));
    return false;
  }
}

// 6.1: login recusado porque o e-mail da conta Google já é de outro usuário. Recebe: o google_sub
// de quem tentou e o e-mail (usado só para achar o id do dono; não vai no alerta). Devolve: se gravou.
export async function alertaEmailEmUso(googleSub: string, email: string, agora = new Date()): Promise<boolean> {
  try {
    if (!destino()) return false;
    const { data: dono } = await db().from("rs_usuarios").select("id").eq("email", email).maybeSingle();
    if (!dono) return false;
    const { data: tentou } = await db().from("rs_usuarios").select("id").eq("google_sub", googleSub).maybeSingle();
    const c = copy.emailAlertas.emailEmUso;
    return enfileira("email_em_uso", `${dono.id}:${dia(agora)}`, alertaInstancia({ assunto: c.assunto, paragrafos: [c.corpo, c.ids(dono.id, tentou?.id ?? null)], depois: c.depois }));
  } catch (e) {
    console.error("alerta_instancia_falhou", "email_em_uso", errorCode(e));
    return false;
  }
}

// 18: passos da faxina que falharam. Recebe: [{passo, codigo}]. Vazio: nada. Devolve: se gravou.
export async function alertaFaxina(falhas: { passo: string; codigo: string }[], agora = new Date()): Promise<boolean> {
  if (!falhas.length) return false;
  const c = copy.emailAlertas.faxina;
  return enfileira("faxina", dia(agora), alertaInstancia({ assunto: c.assunto(falhas.length), paragrafos: [c.corpo, ...falhas.map((f) => c.linha(f.passo, f.codigo))], depois: c.depois }));
}

// O plano do banco em MB: ALERTA_BANCO_LIMITE_MB (inteiro positivo) ou o padrão.
function limiteDoBancoMb(): number {
  const v = Number(process.env.ALERTA_BANCO_LIMITE_MB);
  return Number.isFinite(v) && v > 0 ? v : ALERTA_BANCO_LIMITE_MB_PADRAO;
}

// 23.1: banco acima de 70% do plano (passo da faxina). Devolve 1 se o alerta entrou na fila, senão 0.
// Lança se não conseguir medir (a faxina anota o passo em `falharam`).
export async function alertaBanco(agora = new Date()): Promise<number> {
  if (!destino()) return 0;
  const { data, error } = await db().rpc("rs_fn_tamanho_banco");
  if (error) throw error;
  const usadoMb = Math.round(Number(data) / 1024 ** 2);
  const limiteMb = limiteDoBancoMb();
  if (usadoMb < limiteMb * ALERTA_BANCO_FRACAO) return 0;
  const c = copy.emailAlertas.banco;
  const ok = await enfileira("banco", dia(agora), alertaInstancia({ assunto: c.assunto(Math.round((usadoMb / limiteMb) * 100)), paragrafos: [c.corpo(usadoMb, limiteMb)], depois: c.depois }));
  return ok ? 1 : 0;
}

// 11.14: currículo recusado por falta de espaço → e-mail aos administradores da empresa, uma vez por
// dia. Recebe: a empresa e o uso em bytes. Nunca lança.
export async function avisaArmazenamentoCheio(empresa: { id: string; nome: string }, usoBytes: number, agora = new Date()): Promise<void> {
  try {
    const { data, error } = await db()
      .from("rs_membros")
      .select("id, rs_usuarios!inner(email, suspenso_em)")
      .eq("empresa_id", empresa.id)
      .eq("papel", "administrador")
      .is("removido_em", null);
    if (error) throw error;
    const msg = armazenamentoCheio({ empresa: empresa.nome, usadoGb: (usoBytes / 1024 ** 3).toFixed(1), limiteGb: USO_EMPRESA_MAX_BYTES / 1024 ** 3 });
    for (const m of data ?? []) {
      if (m.rs_usuarios.suspenso_em) continue;
      await enqueue({ empresaId: empresa.id, tipo: "armazenamento_cheio", destinatario: m.rs_usuarios.email, chave: `armazenamento_cheio:${empresa.id}:${m.id}:${dia(agora)}`, ...msg });
    }
  } catch (e) {
    console.error("aviso_armazenamento_falhou", errorCode(e));
  }
}
