// Decisões e propostas — domínio do épico 8.6 (11.5, 11.7, 11.23, 12.3). Decidir (reprovar,
// contratar, encerrar vaga com ativas, reabrir) só acontece pelo clique de um membro: decideNow
// (formulário decisoes) e confirmProposals (formulário propostas). A API v1 e o propor_decisao só
// criam proposta (proposeDecision). O banco confere de novo: só membro executa, devolutiva de 20+,
// alvo que mudou vira expirada.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { DECISOES_LOTE_MAX, DEVOLUTIVA_MAX, DEVOLUTIVA_MIN } from "@/lib/limits";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { CamposInvalidos, DomainError } from "@/server/http";
import { enqueue } from "@/server/email/outbox";
import { decisoesPendentes } from "@/server/email/templates";
import { atorJson } from "@/server/org/actor";
import { alcanceJson, type ContextoVagas } from "./jobs";
import { getTemplate } from "@/server/messages/templates";
import { entregar, mensagensDaVaga, montarMensagem, type MensagemPronta, type TextoMensagem } from "./messages";
import { quemDoAtor, track } from "@/server/analytics/client";
import { origemDoAtor } from "@/server/analytics/events";
import { diasDesde } from "@/server/recruiting/applications";

type Enums = Database["public"]["Enums"];
export type TipoDecisao = Enums["rs_tipo_decisao"];
export type MotivoReprovacao = Enums["rs_motivo_reprovacao"];
type Ctx = ContextoVagas & { empresa: { nome: string } };

export const MOTIVOS_REPROVACAO = ["requisitos", "experiencia", "perfil", "pretensao_salarial", "localizacao", "outro_candidato", "sem_retorno", "outro"] as const;
export const MOTIVOS_ENCERRAMENTO = ["preenchida", "cancelada", "outro"] as const;

// Um item do formulário de decisões (ou de uma proposta confirmada). `texto`: a mensagem ao
// candidato (devolutiva em reprovar e encerrar vaga; opcional em contratar), com variáveis.
export type ItemDecisao =
  | { tipo: "reprovar"; candidatura: string; motivo: MotivoReprovacao; texto: TextoMensagem }
  | { tipo: "contratar"; candidatura: string; texto: TextoMensagem | null }
  | { tipo: "encerrar_vaga"; vaga: string; motivo_encerramento: (typeof MOTIVOS_ENCERRAMENTO)[number]; texto: TextoMensagem }
  | { tipo: "reabrir"; candidatura: string }
  // Só por proposta confirmada (a API com mensagens_agente = confirmar); o formulário não oferece.
  | { tipo: "enviar_mensagem"; candidatura: string; texto: TextoMensagem };

export type ResultadoItem = { ok: true } | { ok: false; codigo: string };

// Devolutiva de 20 a 3.000 (11.5), conferida antes de montar (o banco confere de novo).
function conferirDevolutiva(texto: TextoMensagem | null, campo: string) {
  const n = texto?.corpo.trim().length ?? 0;
  if (n < DEVOLUTIVA_MIN || n > DEVOLUTIVA_MAX) throw new CamposInvalidos([{ campo, codigo: "devolutiva_obrigatoria" }]);
}

// Executa um item decidido pelo membro (o ator do contexto é o membro, origem formulário).
async function executar(ctx: Ctx, item: ItemDecisao, decisaoId?: string): Promise<{ resultado: Record<string, unknown> | null; mensagens: MensagemPronta[] }> {
  const alcance = alcanceJson(ctx.alcance) as never;
  const ator = atorJson(ctx.ator);
  if (item.tipo === "reabrir") {
    const { error } = await db().rpc("rs_fn_reabre_candidatura", { p_candidatura: item.candidatura, p_empresa: ctx.empresa.id, p_alcance: alcance, p_ator: ator });
    if (error) throw error;
    return { resultado: null, mensagens: [] };
  }
  let mensagens: Record<string, MensagemPronta> = {};
  let payload: Record<string, unknown> = {};
  if (item.tipo === "reprovar") {
    conferirDevolutiva(item.texto, "devolutiva");
    mensagens = { [item.candidatura]: await montarMensagem(ctx, item.candidatura, "devolutiva", item.texto) };
    payload = { motivo: item.motivo };
  } else if (item.tipo === "contratar") {
    if (item.texto) mensagens = { [item.candidatura]: await montarMensagem(ctx, item.candidatura, "contato", item.texto) };
  } else if (item.tipo === "enviar_mensagem") {
    mensagens = { [item.candidatura]: await montarMensagem(ctx, item.candidatura, "contato", item.texto) };
  } else {
    conferirDevolutiva(item.texto, "devolutiva");
    mensagens = await mensagensDaVaga(ctx, item.vaga, item.texto);
    payload = { motivo_encerramento: item.motivo_encerramento };
  }
  const candidatura = item.tipo === "encerrar_vaga" ? null : item.candidatura;
  const vaga = item.tipo === "encerrar_vaga" ? item.vaga : null;
  if (decisaoId) {
    const { data, error } = await db().rpc("rs_fn_confirma_decisao", {
      p_decisao: decisaoId, p_empresa: ctx.empresa.id, p_alcance: alcance, p_payload: payload as never, p_mensagens: mensagens as never, p_ator: ator,
    });
    if (error) throw error;
    const r = data as { status: string; motivo?: string };
    return { resultado: r, mensagens: r.status === "confirmada" ? Object.values(mensagens) : [] };
  }
  const { error } = await db().rpc("rs_fn_decide", {
    p_empresa: ctx.empresa.id, p_tipo: item.tipo, p_candidatura: candidatura as never, p_vaga: vaga as never,
    p_payload: payload as never, p_mensagens: mensagens as never, p_alcance: alcance, p_ator: ator,
  });
  if (error) throw error;
  return { resultado: null, mensagens: Object.values(mensagens) };
}

// Código de erro de um item, para o formulário marcar a linha (sem derrubar os outros).
function codigoDoErro(e: unknown): string {
  if (e instanceof CamposInvalidos) return e.campos[0]?.codigo ?? "dados_invalidos";
  if (e instanceof DomainError) return e.codigo;
  const m = (e as { message?: string })?.message;
  return typeof m === "string" && /^[a-z_]+$/.test(m) ? m : "generico";
}

// Decide na hora, pelo formulário de decisões (11.7): cada item independente, até 50. Os e-mails
// saem depois de cada item gravado. Recebe: contexto (o membro) e os itens.
// ---------------------------------------------------------------- analytics (8.11; seção 21)
// Depois de uma decisão executada: contrata_decisao_confirmada e, para cada candidatura que ela
// encerrou, contrata_candidatura_encerrada (só enums e números; nada pessoal). Nunca lança.
function rastreia(ctx: Ctx, item: ItemDecisao, extra: { editada: boolean; criadaEm: string | null; lote: number; decisaoId?: string }) {
  const quem = quemDoAtor(ctx.ator, ctx.empresa.id);
  const tipo = item.tipo;
  track("contrata_decisao_confirmada", {
    quem, chave: extra.decisaoId,
    propriedades: { tipo, editada: extra.editada, horas_ate_confirmar: extra.criadaEm ? Math.round(((Date.now() - new Date(extra.criadaEm).getTime()) / 3_600_000) * 10) / 10 : 0, lote: extra.lote },
  });
  if (tipo === "reabrir" || tipo === "enviar_mensagem") return;
  const situacao = tipo === "reprovar" ? "reprovada" : tipo === "contratar" ? "contratada" : "encerrada_vaga";
  // As encerradas agora (as da vaga, no encerrar_vaga), com o tempo desde que chegaram.
  const encerradas = async () => {
    let q = db().from("rs_candidaturas").select("id, recebida_em").eq("empresa_id", ctx.empresa.id).eq("situacao", situacao)
      .gte("encerrada_em", new Date(Date.now() - 10 * 60_000).toISOString());
    q = item.tipo === "encerrar_vaga" ? q.eq("vaga_id", item.vaga) : q.eq("id", item.candidatura);
    const { data } = await q;
    return (data ?? []) as { id: string; recebida_em: string | null }[];
  };
  void encerradas().then((lista) => {
    for (const c of lista) {
      track("contrata_candidatura_encerrada", {
        quem, chave: c.id, propriedades: { situacao, origem: origemDoAtor(ctx.ator), dias_ate_encerrar: c.recebida_em ? diasDesde(c.recebida_em) : 0 },
      });
    }
  }).catch(() => undefined);
}

export async function decideNow(ctx: Ctx, itens: Exclude<ItemDecisao, { tipo: "enviar_mensagem" }>[]): Promise<ResultadoItem[]> {
  if (!itens.length || itens.length > DECISOES_LOTE_MAX) throw new CamposInvalidos([{ campo: "itens", codigo: "lote_decisoes" }]);
  if (ctx.ator.tipo !== "membro") throw new DomainError("decisao_so_por_pessoa", 403);
  const out: ResultadoItem[] = [];
  for (const item of itens) {
    try {
      const r = await executar(ctx, item);
      await entregar(ctx.empresa, r.mensagens);
      out.push({ ok: true });
      rastreia(ctx, item, { editada: false, criadaEm: null, lote: itens.length });
    } catch (e) {
      out.push({ ok: false, codigo: codigoDoErro(e) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- propostas
const payloadSchemas = {
  reprovar: z.object({ motivo: z.enum(MOTIVOS_REPROVACAO), devolutiva: z.string().trim().min(DEVOLUTIVA_MIN).max(DEVOLUTIVA_MAX), assunto: z.string().trim().min(2).max(200).optional() }),
  contratar: z.object({ mensagem: z.string().trim().min(2).max(DEVOLUTIVA_MAX).optional(), assunto: z.string().trim().min(2).max(200).optional() }),
  encerrar_vaga: z.object({ motivo_encerramento: z.enum(MOTIVOS_ENCERRAMENTO), devolutiva: z.string().trim().min(DEVOLUTIVA_MIN).max(DEVOLUTIVA_MAX), assunto: z.string().trim().min(2).max(200).optional() }),
  enviar_mensagem: z.object({ assunto: z.string().trim().min(2).max(200), corpo: z.string().trim().min(2).max(5000), tipo: z.literal("contato").optional() }),
} as const;

// Cria uma proposta pendente (API v1 com escopo decisao; propor_decisao sem formulário). Nunca
// executa. Recebe: contexto (api ou agente), tipo, alvo, payload e justificativa. Devolve o id.
export async function proposeDecision(ctx: Ctx, p: { tipo: TipoDecisao; candidatura?: string; vaga?: string; payload: unknown; justificativa?: string | null }) {
  let entrada = (p.payload ?? {}) as Record<string, unknown>;
  // 12.1: encerrar a vaga sem devolutiva usa o modelo padrão do motivo (preenchida ou cancelada).
  if (p.tipo === "encerrar_vaga" && !(typeof entrada.devolutiva === "string" && entrada.devolutiva.trim())) {
    const m = await getTemplate(ctx.empresa.id, entrada.motivo_encerramento === "cancelada" ? "devolutiva_vaga_cancelada" : "devolutiva_vaga_preenchida");
    if (m) entrada = { ...entrada, devolutiva: m.corpo, assunto: typeof entrada.assunto === "string" ? entrada.assunto : m.assunto };
  }
  const s = payloadSchemas[p.tipo].safeParse(entrada);
  if (!s.success) {
    const campos = [...new Set(s.error.issues.map((i) => String(i.path[0])))];
    throw new CamposInvalidos(campos.map((campo) => ({ campo, codigo: campo === "devolutiva" ? "devolutiva_obrigatoria" : "campo_invalido" })));
  }
  if (p.justificativa && p.justificativa.length > 2000) throw new CamposInvalidos([{ campo: "justificativa", codigo: "campo_invalido" }]);
  const { data, error } = await db().rpc("rs_fn_propoe_decisao", {
    p_empresa: ctx.empresa.id, p_tipo: p.tipo, p_candidatura: (p.candidatura ?? null) as never, p_vaga: (p.vaga ?? null) as never,
    p_payload: s.data as never, p_justificativa: (p.justificativa ?? null) as never, p_ator: atorJson(ctx.ator), p_alcance: alcanceJson(ctx.alcance) as never,
  });
  if (error) throw error;
  track("contrata_decisao_proposta", { quem: quemDoAtor(ctx.ator, ctx.empresa.id), chave: data as string, propriedades: { tipo: p.tipo, origem: origemDoAtor(ctx.ator) } });
  return { decisao_id: data as string, mensagem: copy.decisoes.propostaCriada };
}

export type Proposta = {
  id: string; tipo: TipoDecisao; status: Enums["rs_status_decisao"];
  candidatura: { id: string; nome: string } | null; vaga: { id: string; titulo: string } | null;
  payload: Record<string, unknown>; justificativa: string | null; proposta_por: string; criado_em: string; expira_em: string;
  invalida: string | null;
};

// Propostas no alcance (11.32), com quem propôs e, nas pendentes, se ainda valem. O avaliador não
// confirma nada, então não vê propostas. Recebe: contexto e filtro de status.
export async function listProposals(ctx: ContextoVagas, filtros: { status?: Enums["rs_status_decisao"]; id?: string } = {}): Promise<Proposta[]> {
  if (ctx.alcance.tipo === "equipe") return [];
  let q = db().from("rs_decisoes")
    .select("id, tipo, status, payload, justificativa, proposta_por_tipo, proposta_por_membro_id, credencial_id, criado_em, expira_em, " +
      "candidatura:candidatura_id(id, situacao, candidato:candidato_id(nome, anonimizado_em)), vaga:vaga_id(id, titulo, status, area_id)")
    .eq("empresa_id", ctx.empresa.id).order("criado_em");
  if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.id) q = q.eq("id", filtros.id);
  const { data, error } = await q;
  if (error) throw error;
  type Linha = {
    id: string; tipo: TipoDecisao; status: Enums["rs_status_decisao"]; payload: Record<string, unknown>; justificativa: string | null;
    proposta_por_tipo: string; proposta_por_membro_id: string | null; credencial_id: string; criado_em: string; expira_em: string;
    candidatura: { id: string; situacao: string; candidato: { nome: string; anonimizado_em: string | null } } | null;
    vaga: { id: string; titulo: string; status: string; area_id: string | null } | null;
  };
  const linhas = ((data ?? []) as unknown as Linha[]).filter((l) => ctx.alcance.tipo === "todas" || (ctx.alcance.tipo === "areas" && !!l.vaga?.area_id && ctx.alcance.areaIds.includes(l.vaga.area_id)));
  const credenciais = await rotulos(ctx.empresa.id, linhas.map((l) => l.credencial_id), linhas.map((l) => l.proposta_por_membro_id).filter((x): x is string => !!x));
  const agora = Date.now();
  return linhas.map((l) => {
    const encerrada = l.candidatura ? l.candidatura.situacao !== "ativa" || !!l.candidatura.candidato.anonimizado_em : false;
    const invalida = l.status !== "pendente" ? null
      : new Date(l.expira_em).getTime() <= agora ? copy.decisoes.invalida.venceu(new Date(l.expira_em).toLocaleDateString("pt-BR"))
      : l.tipo === "encerrar_vaga" ? (l.vaga?.status === "encerrada" ? copy.decisoes.invalida.vaga : null)
      : l.tipo !== "enviar_mensagem" && encerrada ? copy.decisoes.invalida.candidatura : null;
    return {
      id: l.id, tipo: l.tipo, status: l.status,
      candidatura: l.candidatura ? { id: l.candidatura.id, nome: l.candidatura.candidato.nome } : null,
      vaga: l.vaga ? { id: l.vaga.id, titulo: l.vaga.titulo } : null,
      payload: l.payload, justificativa: l.justificativa,
      proposta_por: credenciais(l.proposta_por_tipo, l.credencial_id, l.proposta_por_membro_id),
      criado_em: l.criado_em, expira_em: l.expira_em, invalida,
    };
  });
}

// Rótulo de quem propôs: "Claude · em nome de Ana" ou "Integração · n8n" (15.3).
async function rotulos(empresaId: string, credenciais: string[], membros: string[]) {
  const { data: cs } = credenciais.length
    ? await db().from("rs_credenciais").select("id, nome, cliente:oauth_cliente_id(nome)").eq("empresa_id", empresaId).in("id", [...new Set(credenciais)])
    : { data: [] };
  const { data: ps } = membros.length ? await db().from("rs_pessoas").select("membro_id, nome").eq("empresa_id", empresaId).in("membro_id", [...new Set(membros)]) : { data: [] };
  const cred = new Map((cs ?? []).map((c) => [c.id, { nome: c.nome as string, cliente: (c.cliente as { nome: string } | null)?.nome ?? null }]));
  const pessoa = new Map((ps ?? []).map((p) => [p.membro_id as string, p.nome as string]));
  const a = copy.historico.atores;
  return (tipo: string, credencialId: string, membroId: string | null) =>
    tipo === "api" ? a.integracao(cred.get(credencialId)?.nome ?? "")
      : a.agente(cred.get(credencialId)?.cliente ?? a.agenteSemCliente, (membroId && pessoa.get(membroId)) || a.semNome);
}

// Uma linha do formulário de propostas: confirmar (com o texto ao candidato editado) ou descartar.
export type AcaoProposta = { decisao: string; acao: "confirmar" | "descartar"; texto?: TextoMensagem | null; motivo?: string | null };

// Confirma ou descarta propostas pelo clique de um membro (11.7, 12.3): até 50, cada uma
// independente; a que perdeu o alvo vira expirada com o motivo. Recebe: contexto (o membro) e as
// ações. Devolve o resultado de cada uma.
export async function confirmProposals(ctx: Ctx, acoes: AcaoProposta[]): Promise<(ResultadoItem | { ok: false; codigo: "expirada"; motivo: string })[]> {
  if (!acoes.length || acoes.length > DECISOES_LOTE_MAX) throw new CamposInvalidos([{ campo: "itens", codigo: "lote_decisoes" }]);
  if (ctx.ator.tipo !== "membro") throw new DomainError("decisao_so_por_pessoa", 403);
  const out: (ResultadoItem | { ok: false; codigo: "expirada"; motivo: string })[] = [];
  for (const a of acoes) {
    try {
      if (a.acao === "descartar") {
        const { error } = await db().rpc("rs_fn_descarta_decisao", {
          p_decisao: a.decisao, p_empresa: ctx.empresa.id, p_alcance: alcanceJson(ctx.alcance) as never, p_motivo: (a.motivo ?? null) as never, p_ator: atorJson(ctx.ator),
        });
        if (error) throw error;
        out.push({ ok: true });
        continue;
      }
      const [p] = await listProposals(ctx, { id: a.decisao });
      if (!p) throw new DomainError("nao_encontrado", 404);
      const item = itemDaProposta(p, a.texto ?? null);
      const r = await executar(ctx, item, p.id);
      await entregar(ctx.empresa, r.mensagens);
      const st = r.resultado as { status: string; motivo?: string } | null;
      out.push(st && st.status !== "confirmada" ? { ok: false, codigo: "expirada", motivo: st.motivo ?? "" } : { ok: true });
      if (!st || st.status === "confirmada") {
        // Editada: o texto confirmado não é o que a proposta trazia.
        const pl = p.payload as Record<string, string | undefined>;
        const proposto = pl.devolutiva ?? pl.mensagem ?? pl.corpo ?? "";
        rastreia(ctx, item, { editada: !!a.texto && a.texto.corpo.trim() !== proposto.trim(), criadaEm: p.criado_em, lote: acoes.filter((x) => x.acao !== "descartar").length, decisaoId: p.id });
      }
    } catch (e) {
      out.push({ ok: false, codigo: codigoDoErro(e) });
    }
  }
  return out;
}

// Transforma a proposta (com o texto editado no formulário, se houver) no item a executar.
function itemDaProposta(p: Proposta, texto: TextoMensagem | null): ItemDecisao {
  const pl = p.payload as Record<string, string | undefined>;
  const assuntoPadrao = copy.modelos.devolutiva_padrao.assunto;
  if (p.tipo === "reprovar") {
    return { tipo: "reprovar", candidatura: p.candidatura!.id, motivo: (pl.motivo ?? "outro") as MotivoReprovacao,
      texto: texto ?? { assunto: pl.assunto ?? assuntoPadrao, corpo: pl.devolutiva ?? "" } };
  }
  if (p.tipo === "contratar") {
    // Texto editado no formulário vence o da proposta; apagado = sem mensagem.
    const corpo = texto ? texto.corpo.trim() : pl.mensagem ?? "";
    return { tipo: "contratar", candidatura: p.candidatura!.id, texto: corpo ? { assunto: texto?.assunto || pl.assunto || copy.modelos.contratacao.assunto, corpo } : null };
  }
  if (p.tipo === "encerrar_vaga") {
    return { tipo: "encerrar_vaga", vaga: p.vaga!.id, motivo_encerramento: (pl.motivo_encerramento ?? "outro") as (typeof MOTIVOS_ENCERRAMENTO)[number],
      texto: texto ?? { assunto: pl.assunto ?? assuntoPadrao, corpo: pl.devolutiva ?? "" } };
  }
  return { tipo: "enviar_mensagem", candidatura: p.candidatura!.id,
    texto: texto ?? { assunto: pl.assunto ?? "", corpo: pl.corpo ?? "" } };
}

// ---------------------------------------------------------------- faxina (12.3; decisão 9 do 8.6)
// Propostas pendentes vencidas viram expiradas (rs_fn_faxina_decisoes). Devolve quantas.
export async function expireProposals(lote: number): Promise<number> {
  const { data, error } = await db().rpc("rs_fn_faxina_decisoes", { p_lote: lote });
  if (error) throw error;
  return Number(data ?? 0);
}

// Resumo diário das propostas pendentes há mais de 24 h (decisoes_pendentes): um e-mail por
// recrutador ou administrador que enxerga alguma delas (11.32), uma vez por dia (chave com a data).
// Devolve quantos e-mails entraram na fila.
export async function pendingProposalsDigest(agora = new Date()): Promise<number> {
  const corte = new Date(agora.getTime() - 24 * 3600_000).toISOString();
  const { data, error } = await db().from("rs_decisoes").select("empresa_id, vaga:vaga_id(area_id)").eq("status", "pendente").lt("criado_em", corte);
  if (error) throw error;
  const porEmpresa = new Map<string, (string | null)[]>();
  for (const d of (data ?? []) as unknown as { empresa_id: string; vaga: { area_id: string | null } | null }[]) {
    porEmpresa.set(d.empresa_id, [...(porEmpresa.get(d.empresa_id) ?? []), d.vaga?.area_id ?? null]);
  }
  const dia = agora.toISOString().slice(0, 10);
  let n = 0;
  for (const [empresaId, areas] of porEmpresa) {
    const { data: empresa } = await db().from("rs_empresas").select("nome").eq("id", empresaId).is("excluida_em", null).maybeSingle();
    if (!empresa) continue;
    const { data: membros } = await db().from("rs_membros").select("id, papel, todas_areas, usuario:usuario_id(email), rs_membro_areas(area_id)")
      .eq("empresa_id", empresaId).in("papel", ["administrador", "recrutador"]).is("removido_em", null).not("usuario_id", "is", null);
    for (const m of (membros ?? []) as unknown as { id: string; papel: string; todas_areas: boolean; usuario: { email: string } | null; rs_membro_areas: { area_id: string }[] }[]) {
      const minhas = new Set(m.rs_membro_areas.map((a) => a.area_id));
      const vejo = m.papel === "administrador" || m.todas_areas ? areas.length : areas.filter((a) => a && minhas.has(a)).length;
      if (!vejo || !m.usuario) continue;
      const e = decisoesPendentes({ empresa: empresa.nome, n: vejo });
      const id = await enqueue({ empresaId, tipo: "decisoes_pendentes", destinatario: m.usuario.email, chave: `pendentes:${m.id}:${dia}`, assunto: e.assunto, html: e.html, texto: e.texto });
      if (id) n++;
    }
  }
  return n;
}
