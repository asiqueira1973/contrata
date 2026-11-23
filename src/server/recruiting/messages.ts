// Mensagens ao candidato — domínio do épico 8.6 (11.8, 11.13, 11.29, 15.4, 20.3). Monta cada
// mensagem com as variáveis da candidatura e devolve o pacote que as funções SQL gravam na mesma
// transação da decisão (rs_mensagens com {{link_acompanhamento}} no lugar do link, e a notificação
// com o link resolvido, apagada depois do envio). O envio sai depois do commit, pela fila.
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { ENCERRAR_VAGA_ATIVAS_MAX, MENSAGENS_API_POR_DIA } from "@/lib/limits";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { deliverLater } from "@/server/email/outbox";
import { mensagemCandidato } from "@/server/email/templates";
import { CamposInvalidos, DomainError } from "@/server/http";
import { hashDoLink, linkVigente, urlDoLink } from "@/server/messages/link";
import { conferirVariaveis, getTemplate, listTemplates, primeiroNome, renderizar, type Valores } from "@/server/messages/templates";
import { atorJson } from "@/server/org/actor";
import { siteOrigin } from "@/server/oauth/server";
import { alcanceJson, type ContextoVagas } from "./jobs";
import { urlDoLogo } from "@/server/files/logo";
import { nomeLegivel } from "@/lib/nome";

type TipoMensagem = Database["public"]["Enums"]["rs_tipo_mensagem"];
export type TextoMensagem = { assunto: string; corpo: string };
// O que as funções SQL recebem por candidatura (p_mensagem / p_mensagens).
export type MensagemPronta = {
  tipo: TipoMensagem; assunto: string; corpo: string;
  notificacao: { tipo: "mensagem_candidato"; destinatario: string; chave: string; assunto: string; html: string; texto: string; reply_to: string };
};

type DadosCandidatura = {
  id: string; vaga_id: string; nome: string; email: string | null; talentos: boolean; vaga: { titulo: string; slug: string };
  empresa: { nome: string; slug: string; email_contato: string; cor_destaque: string | null; logo_path: string | null };
};

type Candidato = { nome: string; email: string | null; talentos_consentido_em: string | null; talentos_expira_em: string | null };
// Está no banco de talentos agora (11.12): consentiu e o prazo não venceu.
const noBanco = (c: Candidato) => !!c.talentos_consentido_em && (!c.talentos_expira_em || new Date(c.talentos_expira_em) > new Date());
// Texto que fala do banco de talentos (uso real, 23/11/2026): só vai a quem autorizou.
const FALA_DE_TALENTOS = /banco\s+de\s+talentos/i;

// Dados de uma candidatura recebida da empresa, para montar a mensagem.
async function dados(empresaId: string, id: string): Promise<DadosCandidatura> {
  const { data, error } = await db().from("rs_candidaturas")
    .select("id, vaga_id, candidato:candidato_id(nome, email, talentos_consentido_em, talentos_expira_em), vaga:vaga_id(titulo, slug), empresa:empresa_id(nome, slug, email_contato, cor_destaque, logo_path)")
    .eq("empresa_id", empresaId).eq("id", id).not("recebida_em", "is", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new DomainError("candidatura_nao_encontrada", 404);
  const d = data as unknown as { id: string; vaga_id: string; candidato: Candidato; vaga: DadosCandidatura["vaga"]; empresa: DadosCandidatura["empresa"] };
  return { id: d.id, vaga_id: d.vaga_id, nome: d.candidato.nome, email: d.candidato.email, talentos: noBanco(d.candidato), vaga: d.vaga, empresa: d.empresa };
}

// {{recrutador}} e {{link_agenda}} (11.29): quem envia, ou o responsável da vaga quando quem age é
// agente ou integração. Recebe: contexto e vaga.
export async function remetente(ctx: ContextoVagas, vagaId: string): Promise<{ nome: string; link_agenda: string }> {
  let membroId = ctx.ator.tipo === "membro" ? ctx.ator.membroId : undefined;
  if (!membroId) {
    const { data } = await db().from("rs_vaga_equipe").select("membro_id").eq("vaga_id", vagaId).eq("papel_na_vaga", "responsavel").maybeSingle();
    membroId = data?.membro_id ?? ctx.ator.membroId;
  }
  if (!membroId) return { nome: "", link_agenda: "" };
  const { data: m } = await db().from("rs_membros").select("link_agenda").eq("empresa_id", ctx.empresa.id).eq("id", membroId).maybeSingle();
  const { data: p } = await db().from("rs_pessoas").select("nome").eq("empresa_id", ctx.empresa.id).eq("membro_id", membroId).maybeSingle();
  return { nome: nomeLegivel(p?.nome ?? ""), link_agenda: m?.link_agenda ?? "" };
}

// Valores das variáveis de uma candidatura (sem o link de acompanhamento, que entra só no e-mail).
async function valores(ctx: ContextoVagas, d: DadosCandidatura): Promise<Valores> {
  const r = await remetente(ctx, d.vaga_id);
  return {
    nome: primeiroNome(d.nome), nome_completo: d.nome, vaga: d.vaga.titulo, empresa: d.empresa.nome,
    link_vaga: `${siteOrigin()}/${d.empresa.slug}/vagas/${d.vaga.slug}`, recrutador: r.nome, link_agenda: r.link_agenda,
  };
}

// Monta a mensagem de uma candidatura a partir de um texto com variáveis. Recebe: contexto, id,
// tipo e o texto. Devolve o pacote para o SQL e a chave da notificação (para entregar depois).
export async function montarMensagem(ctx: ContextoVagas, id: string, tipo: TipoMensagem, texto: TextoMensagem): Promise<MensagemPronta> {
  conferirVariaveis({ assunto: texto.assunto, corpo: texto.corpo });
  const d = await dados(ctx.empresa.id, id);
  return montarCom(d, await valores(ctx, d), await linkVigente(ctx.empresa.id, id), tipo, texto);
}

// Monta a mensagem com os dados já carregados (uma pessoa, ou cada pessoa de uma vaga em lote).
// Regra 11.12 e 20 (uso real): a mensagem não promete o banco de talentos a quem não autorizou.
function montarCom(d: DadosCandidatura, v: Valores, url: string | null, tipo: TipoMensagem, texto: TextoMensagem): MensagemPronta {
  if (!d.email) throw new DomainError("candidatura_anonimizada", 409);
  if (!d.talentos && FALA_DE_TALENTOS.test(`${texto.assunto}\n${texto.corpo}`)) throw new CamposInvalidos([{ campo: "texto", codigo: "talentos_sem_consentimento" }]);
  const id = d.id;
  const assunto = renderizar(texto.assunto, v);
  const guardado = renderizar(texto.corpo, v, { manterLink: true });
  const corpoEmail = renderizar(texto.corpo, { ...v, link_acompanhamento: url ?? "" });
  const email = mensagemCandidato({ empresa: d.empresa.nome, cor: d.empresa.cor_destaque, logo: urlDoLogo(d.empresa.slug, d.empresa.logo_path), assunto, corpo: corpoEmail, url, devolutiva: tipo === "devolutiva" });
  return {
    tipo, assunto, corpo: guardado,
    notificacao: { tipo: "mensagem_candidato", destinatario: d.email, chave: `mensagem:${id}:${randomUUID()}`, assunto, html: email.html, texto: email.texto, reply_to: d.empresa.email_contato },
  };
}

// Texto final ao candidato, para o formulário mostrar e deixar editar (11.7): variáveis trocadas,
// menos {{link_acompanhamento}}, que fica para o envio. Recebe: contexto, candidatura e o texto.
export async function textoFinal(ctx: ContextoVagas, id: string, texto: TextoMensagem): Promise<TextoMensagem & { nome: string; vaga: string }> {
  const d = await dados(ctx.empresa.id, id);
  const v = await valores(ctx, d);
  return { assunto: renderizar(texto.assunto, v), corpo: renderizar(texto.corpo, v, { manterLink: true }), nome: d.nome, vaga: d.vaga.titulo };
}

// Mensagens de todas as candidaturas em andamento recebidas de uma vaga (encerrar vaga, 11.5): a
// mesma devolutiva, com as variáveis de cada pessoa. Carrega tudo de uma vez (até 1.000) e confere o
// teto antes de montar. Devolve o mapa candidatura → mensagem.
export async function mensagensDaVaga(ctx: ContextoVagas, vagaId: string, texto: TextoMensagem): Promise<Record<string, MensagemPronta>> {
  conferirVariaveis({ assunto: texto.assunto, corpo: texto.corpo });
  const { data, error } = await db().from("rs_candidaturas")
    .select("id, vaga_id, link_versao, token_hash, candidato:candidato_id(nome, email, talentos_consentido_em, talentos_expira_em), vaga:vaga_id(titulo, slug), empresa:empresa_id(nome, slug, email_contato, cor_destaque, logo_path)")
    .eq("empresa_id", ctx.empresa.id).eq("vaga_id", vagaId).eq("situacao", "ativa").not("recebida_em", "is", null).limit(ENCERRAR_VAGA_ATIVAS_MAX + 1);
  if (error) throw error;
  type Linha = { id: string; vaga_id: string; link_versao: number; token_hash: string; candidato: Candidato; vaga: DadosCandidatura["vaga"]; empresa: DadosCandidatura["empresa"] };
  const linhas = (data ?? []) as unknown as Linha[];
  if (linhas.length > ENCERRAR_VAGA_ATIVAS_MAX) throw new DomainError("lote_grande_demais", 409);
  const out: Record<string, MensagemPronta> = {};
  if (!linhas.length) return out;
  const r = await remetente(ctx, vagaId);
  for (const l of linhas) {
    const d: DadosCandidatura = { id: l.id, vaga_id: l.vaga_id, nome: l.candidato.nome, email: l.candidato.email, talentos: noBanco(l.candidato), vaga: l.vaga, empresa: l.empresa };
    if (!d.email) continue;
    const v: Valores = { nome: primeiroNome(d.nome), nome_completo: d.nome, vaga: d.vaga.titulo, empresa: d.empresa.nome,
      link_vaga: `${siteOrigin()}/${d.empresa.slug}/vagas/${d.vaga.slug}`, recrutador: r.nome, link_agenda: r.link_agenda };
    // Link: o derivado da versão atual; hash antigo gira (raro, candidaturas de antes do 8.6).
    const url = l.token_hash === hashDoLink(l.id, l.link_versao) ? urlDoLink(l.id, l.link_versao) : await linkVigente(ctx.empresa.id, l.id);
    out[l.id] = montarCom(d, v, url, "devolutiva", texto);
  }
  return out;
}

// Entrega as notificações das mensagens gravadas (depois do commit), pela chave.
export async function entregar(empresa: { id: string; nome: string }, mensagens: MensagemPronta[]): Promise<void> {
  const chaves = mensagens.map((m) => m.notificacao.chave);
  // Em lotes: muitas chaves numa consulta passam do tamanho de URL do PostgREST (achado do verifier).
  for (let i = 0; i < chaves.length; i += 50) {
    const { data, error } = await db().from("rs_notificacoes").select("id").eq("empresa_id", empresa.id).in("chave_idempotencia", chaves.slice(i, i + 50)).eq("status", "pendente");
    if (error) throw error;
    for (const n of data ?? []) await deliverLater(n.id, empresa.nome);
  }
}

// Texto de uma mensagem: o modelo (com o que a empresa personalizou) ou o texto livre; o texto
// livre vence o do modelo campo a campo.
export async function textoDaMensagem(empresaId: string, p: { modelo?: string | null; assunto?: string | null; corpo?: string | null }): Promise<TextoMensagem> {
  const m = p.modelo ? await getTemplate(empresaId, p.modelo) : null;
  if (p.modelo && !m) throw new CamposInvalidos([{ campo: "modelo", codigo: "modelo_nao_encontrado" }]);
  const assunto = (p.assunto ?? "").trim() || m?.assunto || "";
  const corpo = (p.corpo ?? "").trim() || m?.corpo || "";
  const erros = [
    ...(assunto.length < 2 || assunto.length > 200 ? [{ campo: "assunto", codigo: "mensagem_invalida" }] : []),
    ...(corpo.length < 2 || corpo.length > 5000 ? [{ campo: "corpo", codigo: "mensagem_invalida" }] : []),
  ];
  if (erros.length) throw new CamposInvalidos(erros);
  return { assunto, corpo };
}

// Mensagem pelo chat (formulário mensagem, classe F): o clique do membro é a confirmação (11.8).
// Recebe: contexto, candidatura e texto. Devolve o id da mensagem.
export async function sendMessage(ctx: ContextoVagas & { empresa: { nome: string } }, candidatura: string, texto: TextoMensagem, tipo: TipoMensagem = "contato") {
  const m = await montarMensagem(ctx, candidatura, tipo, texto);
  const { data, error } = await db().rpc("rs_fn_envia_mensagem", {
    p_candidatura: candidatura, p_empresa: ctx.empresa.id, p_tipo: tipo, p_mensagem: m as never, p_ator: atorJson(ctx.ator),
    p_decisao: null as never, p_cota: null as never,
  });
  if (error) throw error;
  await entregar(ctx.empresa, [m]);
  return { id: data as string };
}

// Mensagem pela API v1 (11.8): mensagens_agente = direto envia na hora, dentro da cota diária das
// chaves; confirmar (padrão) vira proposta enviar_mensagem. Devolve {enviada} ou {decisao_id}.
export async function sendMessageFromApi(ctx: ContextoVagas & { empresa: { nome: string } }, candidatura: string,
  corpo: { modelo?: string | null; assunto?: string | null; corpo?: string | null; justificativa?: string | null }) {
  const texto = await textoDaMensagem(ctx.empresa.id, corpo);
  conferirVariaveis({ assunto: texto.assunto, corpo: texto.corpo });
  const { data: empresa, error } = await db().from("rs_empresas").select("mensagens_agente").eq("id", ctx.empresa.id).single();
  if (error) throw error;
  if (empresa.mensagens_agente === "direto") {
    const m = await montarMensagem(ctx, candidatura, "contato", texto);
    const { data, error: e } = await db().rpc("rs_fn_envia_mensagem", {
      p_candidatura: candidatura, p_empresa: ctx.empresa.id, p_tipo: "contato", p_mensagem: m as never, p_ator: atorJson(ctx.ator),
      p_decisao: null as never, p_cota: MENSAGENS_API_POR_DIA,
    });
    if (e) throw e;
    await entregar(ctx.empresa, [m]);
    return { enviada: true as const, mensagem_id: data as string };
  }
  const { data, error: e } = await db().rpc("rs_fn_propoe_decisao", {
    p_empresa: ctx.empresa.id, p_tipo: "enviar_mensagem", p_candidatura: candidatura, p_vaga: null as never,
    p_payload: { tipo: "contato", assunto: texto.assunto, corpo: texto.corpo } as never, p_justificativa: corpo.justificativa ?? (null as never),
    p_ator: atorJson(ctx.ator), p_alcance: alcanceJson(ctx.alcance) as never,
  });
  if (e) throw e;
  return { enviada: false as const, decisao_id: data as string };
}

// Resposta ao pedido de revisão (11.13): mensagem resposta_revisao e, se pedido, a reabertura (é
// decisão: o banco só aceita reabrir com um membro como ator, o clique no formulário).
export async function respondReview(ctx: ContextoVagas & { empresa: { nome: string } }, candidatura: string, texto: TextoMensagem, reabrir: boolean) {
  const m = await montarMensagem(ctx, candidatura, "resposta_revisao", texto);
  const { error } = await db().rpc("rs_fn_responde_revisao", {
    p_candidatura: candidatura, p_empresa: ctx.empresa.id, p_alcance: alcanceJson(ctx.alcance) as never, p_mensagem: m as never,
    p_reabrir: reabrir, p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  await entregar(ctx.empresa, [m]);
}

// ---------------------------------------------------------------- modelos (decisão 6 do 8.6)
const modeloSchema = z.object({
  chave: z.string().trim().regex(/^[a-z0-9_]{2,60}$/),
  nome: z.string().trim().min(2).max(80),
  assunto: z.string().trim().min(2).max(200),
  corpo: z.string().trim().min(2).max(5000),
});

// Salva (cria ou personaliza) um modelo da empresa. Variável desconhecida é recusada (11.29).
export async function saveTemplate(empresaId: string, entrada: unknown) {
  const p = modeloSchema.safeParse(entrada);
  if (!p.success) throw new CamposInvalidos([...new Set(p.error.issues.map((i) => String(i.path[0])))].map((campo) => ({ campo, codigo: "campo_invalido" })));
  conferirVariaveis({ assunto: p.data.assunto, corpo: p.data.corpo });
  const { error } = await db().from("rs_modelos_mensagem").upsert({ empresa_id: empresaId, ...p.data, atualizado_em: new Date().toISOString() }, { onConflict: "empresa_id,chave" });
  if (error) throw error;
  return p.data;
}

// "Voltar ao padrão": apaga o personalizado (o padrão do copy volta a valer). Modelo novo da
// empresa (sem padrão) é apagado de vez.
export async function resetTemplate(empresaId: string, chave: string) {
  const { error } = await db().from("rs_modelos_mensagem").delete().eq("empresa_id", empresaId).eq("chave", chave);
  if (error) throw error;
}

// Pré-visualização com dados fictícios (copy.modeloFicticio) e o nome da empresa.
export function previewTemplate(empresa: { nome: string; slug: string }, texto: TextoMensagem) {
  const f = copy.modeloFicticio;
  const v: Valores = {
    ...f, empresa: empresa.nome, link_acompanhamento: `${siteOrigin()}/c/…`, link_vaga: `${siteOrigin()}/${empresa.slug}/vagas/…`, link_agenda: "https://…",
  };
  return { assunto: renderizar(texto.assunto, v), corpo: renderizar(texto.corpo, v) };
}

export { listTemplates };
