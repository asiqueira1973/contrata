// Banco de talentos — domínio do épico 8.7 (11.12, 11.27, 11.32, 13.2, 13.3, 15.1, 15.4). Busca só
// entre quem consentiu e ainda está no prazo, no alcance (o avaliador não usa); convida para uma vaga
// publicada sem criar candidatura (o convite vira origem banco_talentos quando a pessoa se candidata
// pelo link); o titular entra, renova e sai pelo /c; a faxina avisa 30 dias antes e tira quem venceu.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { DECISOES_LOTE_MAX, FUSO } from "@/lib/limits";
import { db } from "@/server/db/client";
import { enqueue } from "@/server/email/outbox";
import { conviteVaga, talentosExpirando } from "@/server/email/templates";
import { CamposInvalidos, DomainError } from "@/server/http";
import { linkVigente } from "@/server/messages/link";
import { conferirVariaveis, getTemplate, primeiroNome, renderizar, type Valores } from "@/server/messages/templates";
import { atorJson } from "@/server/org/actor";
import { siteOrigin } from "@/server/oauth/server";
import { requireCandidaturaPorToken } from "./applications";
import { alcanceJson, getJob, type ContextoVagas } from "./jobs";
import { remetente, type TextoMensagem } from "./messages";
import { urlDoLogo } from "@/server/files/logo";

export type Talento = {
  candidato_id: string;
  nome: string;
  cidade: string | null;
  linkedin_url: string | null;
  no_banco_ate: string;
  candidaturas: { id: string; vaga: { id: string; titulo: string }; situacao: string; recebida_em: string }[];
};

const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });

// ---------------------------------------------------------------- buscar (8.7)
// Pessoas do banco no alcance, com as candidaturas anteriores delas que o membro enxerga (para o
// agente ler o currículo com ler_curriculo). Sem e-mail e telefone: o convite sai pelo formulário.
// Recebe: contexto, filtros {q, vaga_anterior} e a página. Devolve: itens e se há mais.
export async function searchTalents(ctx: ContextoVagas, filtros: { q?: string; vaga_anterior?: string }, pagina: { inicio: number; limite: number }) {
  if (ctx.alcance.tipo === "equipe") return { itens: [] as Talento[], mais: false };
  const { data, error } = await db().rpc("rs_fn_busca_talentos", {
    p_empresa: ctx.empresa.id, p_alcance: alcanceJson(ctx.alcance) as never, p_filtros: filtros as never, p_inicio: pagina.inicio, p_limite: pagina.limite + 1,
  });
  if (error) throw error;
  const linhas = (data ?? []) as { candidato_id: string; nome: string; cidade: string | null; linkedin_url: string | null; talentos_expira_em: string }[];
  const mais = linhas.length > pagina.limite;
  const pessoas = linhas.slice(0, pagina.limite);
  const { data: cands, error: e2 } = pessoas.length
    ? await db().from("rs_candidaturas").select("id, candidato_id, situacao, recebida_em, vaga:vaga_id(id, titulo, area_id)")
      .eq("empresa_id", ctx.empresa.id).in("candidato_id", pessoas.map((p) => p.candidato_id)).not("recebida_em", "is", null).order("recebida_em", { ascending: false })
    : { data: [], error: null };
  if (e2) throw e2;
  type C = { id: string; candidato_id: string; situacao: string; recebida_em: string; vaga: { id: string; titulo: string; area_id: string | null } };
  const visivel = (c: C) => ctx.alcance.tipo === "todas" || (ctx.alcance.tipo === "areas" && !!c.vaga.area_id && ctx.alcance.areaIds.includes(c.vaga.area_id));
  const itens: Talento[] = pessoas.map((p) => ({
    candidato_id: p.candidato_id, nome: p.nome, cidade: p.cidade, linkedin_url: p.linkedin_url, no_banco_ate: p.talentos_expira_em,
    candidaturas: ((cands ?? []) as unknown as C[]).filter((c) => c.candidato_id === p.candidato_id && visivel(c))
      .map((c) => ({ id: c.id, vaga: { id: c.vaga.id, titulo: c.vaga.titulo }, situacao: c.situacao, recebida_em: c.recebida_em })),
  }));
  return { itens, mais };
}

// ---------------------------------------------------------------- convidar (8.7)
// Convida até 50 pessoas do banco para uma vaga publicada do alcance: cria (ou reaproveita) o
// convite e manda o e-mail do modelo convite_vaga (ou o texto editado), com o link da vaga +
// ?convite=. Não cria candidatura. Quem já se candidatou à vaga é pulado; quem saiu do banco entre
// abrir e salvar fica de fora sem derrubar o lote (achado do verifier). Um e-mail por convite por dia:
// convidar de novo no mesmo dia não reenvia. Recebe: contexto, candidatos, vaga e o texto (opcional;
// a API v1 não manda texto, só o modelo da empresa). Devolve as contagens e o resumo.
export async function inviteTalents(ctx: ContextoVagas & { empresa: { nome: string } }, p: { candidatos: string[]; vaga: string; texto?: TextoMensagem | null }) {
  const ids = [...new Set(p.candidatos)];
  if (!ids.length || ids.length > DECISOES_LOTE_MAX) throw new CamposInvalidos([{ campo: "candidatos", codigo: "lote_decisoes" }]);
  if (!z.uuid().safeParse(p.vaga).success) throw new DomainError("vaga_nao_encontrada", 404);
  const vaga = await getJob(ctx, p.vaga).catch(() => { throw new DomainError("vaga_nao_encontrada", 404); });
  const modelo = await getTemplate(ctx.empresa.id, "convite_vaga");
  const texto = p.texto ?? { assunto: modelo?.assunto ?? "", corpo: modelo?.corpo ?? "" };
  conferirVariaveis({ assunto: texto.assunto, corpo: texto.corpo });
  const { data: empresa, error } = await db().from("rs_empresas").select("nome, slug, email_contato, cor_destaque, logo_path").eq("id", ctx.empresa.id).single();
  if (error) throw error;
  const r = await remetente(ctx, vaga.id);
  let convidados = 0;
  let pulados = 0;
  let indisponiveis = 0;
  let primeiroIndisponivel: unknown = null;
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
  for (const candidato of ids) {
    const { data, error: e } = await db().rpc("rs_fn_convida_talento", {
      p_empresa: ctx.empresa.id, p_candidato: candidato, p_vaga: vaga.id, p_alcance: alcanceJson(ctx.alcance) as never, p_ator: atorJson(ctx.ator),
    });
    if (e?.message === "talento_indisponivel") {
      indisponiveis++;
      primeiroIndisponivel ??= e;
      continue;
    }
    if (e) throw e;
    const res = data as { convite_id: string | null; ja_candidato: boolean };
    if (res.ja_candidato || !res.convite_id) {
      pulados++;
      continue;
    }
    const { data: k } = await db().from("rs_candidatos").select("nome, email").eq("empresa_id", ctx.empresa.id).eq("id", candidato).single();
    if (!k?.email) continue;
    const urlVaga = `${siteOrigin()}/${empresa.slug}/vagas/${vaga.slug}/candidatar?convite=${res.convite_id}`;
    const v: Valores = { nome: primeiroNome(k.nome), nome_completo: k.nome, vaga: vaga.titulo, empresa: empresa.nome, link_vaga: urlVaga, recrutador: r.nome, link_agenda: r.link_agenda };
    const assunto = renderizar(texto.assunto, v);
    const corpo = renderizar(texto.corpo, v);
    // O link de acompanhamento da candidatura mais recente (para a pessoa sair do banco, se quiser).
    const { data: ultima } = await db().from("rs_candidaturas").select("id").eq("empresa_id", ctx.empresa.id).eq("candidato_id", candidato)
      .not("recebida_em", "is", null).order("recebida_em", { ascending: false }).limit(1).maybeSingle();
    const urlAcompanhamento = ultima ? await linkVigente(ctx.empresa.id, ultima.id) : null;
    const email = conviteVaga({ empresa: empresa.nome, cor: empresa.cor_destaque, logo: urlDoLogo(empresa.slug, empresa.logo_path), assunto, corpo, urlVaga, urlAcompanhamento });
    await enqueue({ empresaId: ctx.empresa.id, tipo: "mensagem_candidato", destinatario: k.email, chave: `convite:${res.convite_id}:${dia}`,
      assunto, html: email.html, texto: email.texto, replyTo: empresa.email_contato, fromName: empresa.nome });
    convidados++;
  }
  // Ninguém convidável no lote: o erro de sempre (409 na API, aviso no formulário).
  if (!convidados && !pulados && primeiroIndisponivel) throw primeiroIndisponivel;
  return { convidados, pulados, indisponiveis, resumo: copy.talentos.convidados(convidados, pulados, indisponiveis) };
}

// ---------------------------------------------------------------- o titular no /c (8.7)
// Entrar, renovar ou sair do banco de talentos pelo link de acompanhamento. Recebe: token e ação.
// Devolve a mensagem para a tela.
export async function talentAction(token: string, acao: unknown): Promise<{ mensagem: string; ate: string | null }> {
  if (acao !== "entrar" && acao !== "renovar" && acao !== "sair") throw new CamposInvalidos([{ campo: "acao", codigo: "acao_invalida" }]);
  const c = await requireCandidaturaPorToken(token);
  if (!c) throw new DomainError("link_invalido", 404);
  const { data, error } = await db().rpc("rs_fn_talentos_candidato", { p_candidatura: c.id, p_acao: acao });
  if (error) throw error;
  const ate = (data as string | null) ?? null;
  return { mensagem: ate ? copy.talentos.renovado(DATA.format(new Date(ate))) : copy.talentos.saiu, ate };
}

// ---------------------------------------------------------------- faxina (11.12; 8.7)
// Tira do banco quem venceu e manda talentos_expirando (com o link do /c para renovar) a quem vence
// em até 30 dias, uma vez por período. Devolve as contagens.
export async function expiringTalentsDigest(lote: number): Promise<{ retirados: number; avisados: number }> {
  const { data, error } = await db().rpc("rs_fn_faxina_talentos", { p_lote: lote });
  if (error) throw error;
  const r = data as { retirados: number; avisar: { empresa_id: string; candidato_id: string; candidatura_id: string; expira_em: string }[] };
  let avisados = 0;
  for (const a of r.avisar) {
    const { data: e } = await db().from("rs_empresas").select("nome, slug, email_contato, cor_destaque, logo_path").eq("id", a.empresa_id).is("excluida_em", null).maybeSingle();
    const { data: k } = await db().from("rs_candidatos").select("nome, email").eq("empresa_id", a.empresa_id).eq("id", a.candidato_id).maybeSingle();
    const url = await linkVigente(a.empresa_id, a.candidatura_id);
    if (!e || !k?.email || !url) continue;
    const m = talentosExpirando({ empresa: e.nome, cor: e.cor_destaque, logo: urlDoLogo(e.slug, e.logo_path), nome: primeiroNome(k.nome), data: DATA.format(new Date(a.expira_em)), url });
    const id = await enqueue({ empresaId: a.empresa_id, tipo: "talentos_expirando", destinatario: k.email, chave: `talentos_expirando:${a.candidato_id}:${a.expira_em}`,
      assunto: m.assunto, html: m.html, texto: m.texto, replyTo: e.email_contato, fromName: e.nome });
    if (id) avisados++;
  }
  return { retirados: r.retirados, avisados };
}
