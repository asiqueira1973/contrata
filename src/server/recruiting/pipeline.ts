// Funil — domínio do épico 8.5 (seções 11.9, 11.10, 11.22, 11.28, 11.30, 11.32, 11.34, 14.1 e
// 15.3). Uma regra, várias portas: as consultas e operações do MCP, o formulário de avaliação e a
// API v1 chamam estas funções. Toda leitura passa pelo alcance (vaga fora do alcance some como se
// não existisse) e só enxerga candidaturas recebidas (8.4). O banco confere de novo alcance, lote
// e equipe (migration rs_funil).
import "server-only";
import { randomUUID } from "node:crypto";
import { copy } from "@/lib/copy";
import { DOWNLOAD_URL_SEGUNDOS, EXPORTACAO_MAX, FUSO } from "@/lib/limits";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { storage } from "@/server/files/storage";
import { DomainError } from "@/server/http";
import { atorJson } from "@/server/org/actor";
import { alcanceJson, getJob, type ContextoVagas, type VagaDetalhe } from "./jobs";

type Enums = Database["public"]["Enums"];
export type Recomendacao = Enums["rs_recomendacao"];
export type SituacaoCandidatura = Enums["rs_situacao_candidatura"];

export type FiltrosCandidaturas = {
  vaga_id?: string;
  etapa_id?: string;
  situacao?: SituacaoCandidatura | "todas";
  sinalizada?: boolean;
  parada_desde?: string;
  pendente_de?: string;
  atualizada_desde?: string;
  q?: string;
  ordem?: "chegada" | "movimentacao";
};

export type CandidaturaNaLista = {
  id: string;
  nome: string;
  vaga: { id: string; titulo: string };
  etapa: { id: string; nome: string } | null;
  situacao: SituacaoCandidatura;
  sinalizada: boolean;
  recebida_em: string;
  movida_em: string;
  encerrada_em: string | null;
  atualizado_em: string;
};

// Avaliador (alcance "equipe") tem a visão restrita da 11.9; recrutador, administrador e a API
// veem tudo.
function visaoRestrita(ctx: ContextoVagas): boolean {
  return ctx.alcance.tipo === "equipe";
}

// ---------------------------------------------------------------- listar e buscar (11.28)
// Lista candidaturas recebidas no alcance, com os filtros do 8.5 e a busca. Recebe: contexto,
// filtros e a página. Devolve: itens e se há mais.
export async function listApplications(ctx: ContextoVagas, filtros: FiltrosCandidaturas, pagina: { inicio: number; limite: number }) {
  const { data, error } = await db().rpc("rs_fn_lista_candidaturas", {
    p_empresa: ctx.empresa.id,
    p_alcance: alcanceJson(ctx.alcance) as never,
    p_filtros: filtros as never,
    p_inicio: pagina.inicio,
    p_limite: pagina.limite + 1,
  });
  if (error) throw error;
  const linhas = (data ?? []) as { id: string; vaga_id: string; etapa_id: string | null; situacao: string; sinalizada: boolean; nome: string;
    recebida_em: string; movida_em: string; encerrada_em: string | null; atualizado_em: string }[];
  const mais = linhas.length > pagina.limite;
  const pagina_ = linhas.slice(0, pagina.limite);
  const vagas = await nomesDeVagas(ctx.empresa.id, [...new Set(pagina_.map((l) => l.vaga_id))]);
  const etapas = await nomesDeEtapas([...new Set(pagina_.map((l) => l.etapa_id).filter((x): x is string => !!x))]);
  const itens: CandidaturaNaLista[] = pagina_.map((l) => ({
    id: l.id,
    nome: l.nome,
    vaga: { id: l.vaga_id, titulo: vagas.get(l.vaga_id) ?? "" },
    etapa: l.etapa_id ? { id: l.etapa_id, nome: etapas.get(l.etapa_id) ?? "" } : null,
    situacao: l.situacao as SituacaoCandidatura,
    sinalizada: l.sinalizada,
    recebida_em: l.recebida_em,
    movida_em: l.movida_em,
    encerrada_em: l.encerrada_em,
    atualizado_em: l.atualizado_em,
  }));
  return { itens, mais };
}

// Título de cada vaga da empresa. Recebe: empresa e ids. Devolve: id → título.
async function nomesDeVagas(empresaId: string, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await db().from("rs_vagas").select("id, titulo").eq("empresa_id", empresaId).in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((v) => [v.id, v.titulo]));
}

// Nome de cada etapa (os ids já passaram pelo alcance). Devolve: id → nome.
async function nomesDeEtapas(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await db().from("rs_etapas").select("id, nome").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((e) => [e.id, e.nome]));
}

// Nome de cada membro (pela pessoa ligada a ele). Recebe: empresa e ids de membro.
async function nomesDeMembros(empresaId: string, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await db().from("rs_pessoas").select("membro_id, nome").eq("empresa_id", empresaId).in("membro_id", ids);
  if (error) throw error;
  return new Map((data ?? []).filter((p) => p.membro_id).map((p) => [p.membro_id!, p.nome]));
}

// ---------------------------------------------------------------- ver (8.5, 11.9, 11.10)
const CAMPOS_CANDIDATURA =
  "id, vaga_id, etapa_id, situacao, origem, sinalizada, recebida_em, movida_em, encerrada_em, atualizado_em, motivo_reprovacao, " +
  "candidato:candidato_id(nome, email, telefone, linkedin_url, cidade), " +
  "rs_respostas(pergunta_id, valor), " +
  "rs_avaliacoes(etapa_id, membro_id, recomendacao, comentario, atualizado_em), " +
  "rs_notas(id, texto, ator_tipo, membro_id, credencial_id, criado_em), " +
  "rs_mensagens(tipo, assunto, corpo, criado_em, notificacao:notificacao_id(status)), " +
  "rs_arquivos(tipo, path, nome_original, bytes, mime, extracao_status, texto_extraido)";

type LinhaCandidatura = {
  id: string; vaga_id: string; etapa_id: string | null; situacao: SituacaoCandidatura; origem: string; sinalizada: boolean;
  recebida_em: string; movida_em: string; encerrada_em: string | null; atualizado_em: string; motivo_reprovacao: string | null;
  candidato: { nome: string; email: string | null; telefone: string | null; linkedin_url: string | null; cidade: string | null };
  rs_respostas: { pergunta_id: string; valor: string }[];
  rs_avaliacoes: { etapa_id: string; membro_id: string; recomendacao: Recomendacao; comentario: string; atualizado_em: string }[];
  rs_notas: { id: string; texto: string; ator_tipo: string; membro_id: string | null; credencial_id: string | null; criado_em: string }[];
  rs_mensagens: { tipo: string; assunto: string; corpo: string; criado_em: string; notificacao: { status: string } | null }[];
  rs_arquivos: { tipo: string; path: string; nome_original: string; bytes: number; mime: string; extracao_status: string; texto_extraido: string | null }[];
};

// Lê a candidatura e a vaga dela, conferindo o alcance pela vaga (getJob some com o que está fora).
async function carregar(ctx: ContextoVagas, id: string): Promise<{ c: LinhaCandidatura; vaga: VagaDetalhe }> {
  const { data, error } = await db().from("rs_candidaturas").select(CAMPOS_CANDIDATURA)
    .eq("empresa_id", ctx.empresa.id).eq("id", id).not("recebida_em", "is", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new DomainError("candidatura_nao_encontrada", 404);
  const c = data as unknown as LinhaCandidatura;
  try {
    return { c, vaga: await getJob(ctx, c.vaga_id) };
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) throw new DomainError("candidatura_nao_encontrada", 404);
    throw e;
  }
}

export type CandidaturaDetalhe = Awaited<ReturnType<typeof getApplication>>;

// Mostra uma candidatura: pessoa, vaga, etapa, situação, respostas (com "Não atende", 11.10),
// avaliações e notas pela regra 11.9 (o avaliador só vê as dos outros numa etapa depois de
// registrar a dele; notas, só depois de avaliar a etapa atual — decisão do 8.5), mensagens e o
// currículo (só metadados; o texto vem por readResume). Recebe: contexto e id.
export async function getApplication(ctx: ContextoVagas, id: string) {
  const { c, vaga } = await carregar(ctx, id);
  const etapas = new Map(vaga.etapas.map((e) => [e.id, e]));
  const restrita = visaoRestrita(ctx);
  const eu = ctx.ator.membroId;
  const etapasAvaliadasPorMim = new Set(c.rs_avaliacoes.filter((a) => a.membro_id === eu).map((a) => a.etapa_id));
  const avaliacoesVisiveis = restrita ? c.rs_avaliacoes.filter((a) => a.membro_id === eu || etapasAvaliadasPorMim.has(a.etapa_id)) : c.rs_avaliacoes;
  const ocultas = c.rs_avaliacoes.length - avaliacoesVisiveis.length;
  const notasVisiveis = !restrita || (c.etapa_id !== null && etapasAvaliadasPorMim.has(c.etapa_id));
  const membros = await nomesDeMembros(ctx.empresa.id, [...new Set([
    ...avaliacoesVisiveis.map((a) => a.membro_id),
    ...(notasVisiveis ? c.rs_notas.map((n) => n.membro_id).filter((x): x is string => !!x) : []),
  ])]);
  const credenciais = notasVisiveis ? await rotulosDeCredenciais(ctx.empresa.id, c.rs_notas.map((n) => n.credencial_id).filter((x): x is string => !!x)) : new Map();
  const cv = c.rs_arquivos.find((a) => a.tipo === "curriculo") ?? null;
  return {
    id: c.id,
    vaga: { id: vaga.id, titulo: vaga.titulo },
    etapa: c.etapa_id && etapas.get(c.etapa_id) ? { id: c.etapa_id, nome: etapas.get(c.etapa_id)!.nome, tipo: etapas.get(c.etapa_id)!.tipo } : null,
    situacao: c.situacao,
    origem: c.origem,
    sinalizada: c.sinalizada,
    recebida_em: c.recebida_em,
    movida_em: c.movida_em,
    encerrada_em: c.encerrada_em,
    atualizado_em: c.atualizado_em,
    pessoa: { nome: c.candidato.nome, email: c.candidato.email, telefone: c.candidato.telefone, linkedin_url: c.candidato.linkedin_url, cidade: c.candidato.cidade },
    respostas: vaga.perguntas
      .map((p) => {
        const r = c.rs_respostas.find((x) => x.pergunta_id === p.id);
        if (!r) return null;
        const naoAtende = p.resposta_esperada !== null && r.valor !== p.resposta_esperada;
        return { pergunta: p.texto, resposta: r.valor, ...(naoAtende ? { selo: copy.funil.naoAtende(p.texto) } : {}) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    avaliacoes: avaliacoesVisiveis
      .map((a) => ({
        etapa: etapas.get(a.etapa_id)?.nome ?? "",
        etapa_id: a.etapa_id,
        membro: membros.get(a.membro_id) ?? copy.historico.atores.semNome,
        membro_id: a.membro_id,
        recomendacao: a.recomendacao,
        comentario: a.comentario,
        atualizado_em: a.atualizado_em,
      }))
      .sort((a, b) => a.atualizado_em.localeCompare(b.atualizado_em)),
    avaliacoes_ocultas: ocultas,
    ...(ocultas > 0 || !notasVisiveis ? { aviso: copy.funil.avaliacaoOculta } : {}),
    notas: notasVisiveis
      ? [...c.rs_notas].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).map((n) => ({
          id: n.id,
          texto: n.texto,
          criado_em: n.criado_em,
          autor: rotuloDeAutor(n.ator_tipo, n.membro_id ? membros.get(n.membro_id) : undefined, n.credencial_id ? credenciais.get(n.credencial_id) : undefined, null),
        }))
      : null,
    mensagens: [...c.rs_mensagens].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).map((m) => ({
      tipo: m.tipo,
      assunto: m.assunto,
      corpo: m.corpo.replace(/\{\{link_acompanhamento\}\}/g, copy.acompanhamento.esteLink),
      criado_em: m.criado_em,
      entrega: m.notificacao?.status ?? null,
    })),
    curriculo: cv ? { nome: cv.nome_original, bytes: cv.bytes, extracao_status: cv.extracao_status } : null,
  };
}

// ---------------------------------------------------------------- currículo (8.5, 20.3)
// Texto extraído do currículo e um link de 5 min para o arquivo. Avisa quando não há texto.
// Recebe: contexto, id e se precisa do link. Devolve: {nome, extracao_status, texto, aviso?, url?}.
export async function readResume(ctx: ContextoVagas, id: string, opts: { link: boolean; texto: boolean } = { link: true, texto: true }) {
  const { c } = await carregar(ctx, id);
  const cv = c.rs_arquivos.find((a) => a.tipo === "curriculo") ?? null;
  if (!cv) return { candidatura_id: c.id, curriculo: null, aviso: copy.funil.curriculo.semCurriculo };
  const aviso = cv.extracao_status === "sem_texto" ? copy.funil.curriculo.semTexto
    : cv.extracao_status === "falhou" ? copy.funil.curriculo.falhou
    : cv.extracao_status === "pendente" ? copy.funil.curriculo.processando : undefined;
  const link = opts.link ? await storage().createDownloadUrl(cv.path, DOWNLOAD_URL_SEGUNDOS, cv.nome_original) : null;
  return {
    candidatura_id: c.id,
    curriculo: {
      nome: cv.nome_original,
      mime: cv.mime,
      bytes: cv.bytes,
      extracao_status: cv.extracao_status,
      ...(opts.texto ? { texto: cv.texto_extraido ?? "" } : {}),
      ...(link ? { url: link.url, url_expira_em: link.expiresAt.toISOString() } : {}),
    },
    ...(aviso ? { aviso } : {}),
  };
}

// ---------------------------------------------------------------- mover e anotar (11.30, 11.34)
// Move de 1 a 100 candidaturas para uma etapa (tudo ou nada). Recebe: contexto, ids e etapa.
// Devolve: quantas mudaram e o nome da etapa.
export async function moveStage(ctx: ContextoVagas, ids: string[], etapaId: string): Promise<{ movidas: number; etapa: string }> {
  const { data, error } = await db().rpc("rs_fn_move_etapa", {
    p_ids: ids, p_empresa: ctx.empresa.id, p_etapa: etapaId, p_alcance: alcanceJson(ctx.alcance) as never, p_ator: atorJson(ctx.ator),
  });
  if (error) throw traduz(error);
  const etapas = await nomesDeEtapas([etapaId]);
  return { movidas: Number(data ?? 0), etapa: etapas.get(etapaId) ?? "" };
}

// Adiciona uma nota (membro, agente em nome do membro ou integração). Recebe: contexto, id e texto.
export async function addNote(ctx: ContextoVagas, id: string, texto: string): Promise<{ id: string }> {
  const { data, error } = await db().rpc("rs_fn_adiciona_nota", {
    p_candidatura: id, p_empresa: ctx.empresa.id, p_alcance: alcanceJson(ctx.alcance) as never, p_texto: texto, p_ator: atorJson(ctx.ator),
  });
  if (error) throw traduz(error);
  return { id: data as string };
}

// Registra ou troca a avaliação do membro numa etapa (11.9; só pela equipe da vaga). Recebe:
// contexto (o ator é o membro que clicou), candidatura, etapa, recomendação e comentário.
export async function registerEvaluation(ctx: ContextoVagas, dados: { candidatura: string; etapa: string; recomendacao: Recomendacao; comentario: string }) {
  if (!ctx.ator.membroId) throw new DomainError("fora_da_equipe", 403);
  const { data, error } = await db().rpc("rs_fn_registra_avaliacao", {
    p_candidatura: dados.candidatura, p_empresa: ctx.empresa.id, p_etapa: dados.etapa, p_membro: ctx.ator.membroId,
    p_recomendacao: dados.recomendacao, p_comentario: dados.comentario, p_ator: atorJson(ctx.ator),
  });
  if (error) throw traduz(error);
  return { id: data as string };
}

// "nao_encontrado" do banco vira o código da candidatura (a copy diz o que fazer).
function traduz(error: { message?: string }) {
  if (error.message === "nao_encontrado") return new DomainError("candidatura_nao_encontrada", 404);
  return error;
}

// ---------------------------------------------------------------- histórico (15.3)
type Credencial = { tipo: string; nome: string; cliente: string | null };

// Tipo, nome e cliente OAuth de cada credencial da empresa, para o rótulo do ator (15.3).
async function rotulosDeCredenciais(empresaId: string, ids: string[]): Promise<Map<string, Credencial>> {
  if (!ids.length) return new Map();
  const { data, error } = await db().from("rs_credenciais").select("id, tipo, nome, cliente:oauth_cliente_id(nome)")
    .eq("empresa_id", empresaId).in("id", [...new Set(ids)]);
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, { tipo: c.tipo, nome: c.nome, cliente: (c.cliente as { nome: string } | null)?.nome ?? null }]));
}

// Rótulo de quem agiu (15.3, decisão 7 do 8.5): "Ana (formulário)", "Claude · em nome de Ana",
// "Integração · n8n", "Sistema", "Candidato".
function rotuloDeAutor(tipo: string, nome: string | undefined, credencial: Credencial | undefined, origem: string | null): string {
  const a = copy.historico.atores;
  const pessoa = nome ?? a.semNome;
  if (tipo === "agente") return a.agente(credencial?.cliente ?? a.agenteSemCliente, pessoa);
  if (tipo === "api") return a.integracao(credencial?.nome ?? "");
  if (tipo === "sistema") return a.sistema;
  if (tipo === "candidato") return a.candidato;
  return origem === "formulario" ? a.formulario(pessoa) : a.membro(pessoa);
}

// Trilha da candidatura com os rótulos da 15.3 e quem agiu; nomes resolvidos na hora (os eventos
// só guardam ids, 11.6). Recebe: contexto e id.
export async function history(ctx: ContextoVagas, id: string) {
  const { c, vaga } = await carregar(ctx, id);
  const { data, error } = await db().from("rs_eventos")
    .select("id, tipo, ator_tipo, membro_id, credencial_id, origem, dados, criado_em")
    .eq("empresa_id", ctx.empresa.id).eq("candidatura_id", c.id).order("id");
  if (error) throw error;
  const eventos = data ?? [];
  // Quem propôs (decisao_confirmada guarda a credencial e o membro do proponente, 8.6).
  const prop = (e: (typeof eventos)[number]) => (e.dados ?? {}) as { proposta_por_credencial_id?: string; proposta_por_membro_id?: string; proposta_por_tipo?: string };
  const membros = await nomesDeMembros(ctx.empresa.id, [...new Set([...eventos.map((e) => e.membro_id), ...eventos.map((e) => prop(e).proposta_por_membro_id)].filter((x): x is string => !!x))]);
  const credenciais = await rotulosDeCredenciais(ctx.empresa.id, [...eventos.map((e) => e.credencial_id), ...eventos.map((e) => prop(e).proposta_por_credencial_id)].filter((x): x is string => !!x));
  const etapa = (x: unknown) => (typeof x === "string" ? vaga.etapas.find((e) => e.id === x)?.nome : undefined);
  // Assunto das mensagens (mensagem_enviada guarda só o id, 11.6).
  const idsMsg = eventos.map((e) => (e.dados as { mensagem_id?: string } | null)?.mensagem_id).filter((x): x is string => !!x);
  const { data: msgs } = idsMsg.length ? await db().from("rs_mensagens").select("id, assunto").in("id", idsMsg) : { data: [] };
  const assuntos = new Map((msgs ?? []).map((m) => [m.id as string, m.assunto as string]));
  return {
    candidatura_id: c.id,
    eventos: eventos.map((e) => {
      const d = (e.dados ?? {}) as Record<string, unknown>;
      const valores: Record<string, string | undefined> = {
        de: etapa(d.de), para: etapa(d.para), etapa: etapa(d.etapa_id),
        origem: typeof d.origem === "string" ? copy.funil.origens[d.origem] ?? d.origem : undefined,
        n: d.n !== undefined ? String(d.n) : undefined,
        tipo: typeof d.tipo === "string" ? copy.decisoes.tipos[d.tipo] ?? d.tipo : undefined,
        assunto: typeof d.mensagem_id === "string" ? assuntos.get(d.mensagem_id) : undefined,
        vaga: vaga.titulo,
      };
      const rotulo = copy.historico.eventos[e.tipo]?.(valores) ?? e.tipo;
      const por = rotuloDeAutor(e.ator_tipo, e.membro_id ? membros.get(e.membro_id) : undefined, e.credencial_id ? credenciais.get(e.credencial_id) : undefined, e.origem);
      const p = prop(e);
      // "proposto por Claude · em nome de Ana · confirmado por Bruno" (8.6, 15.3).
      const proposto = e.tipo === "decisao_confirmada" && p.proposta_por_tipo
        ? copy.historico.atores.confirmado(
          rotuloDeAutor(p.proposta_por_tipo, p.proposta_por_membro_id ? membros.get(p.proposta_por_membro_id) : undefined,
            p.proposta_por_credencial_id ? credenciais.get(p.proposta_por_credencial_id) : undefined, null),
          e.membro_id ? membros.get(e.membro_id) ?? copy.historico.atores.semNome : copy.historico.atores.semNome)
        : null;
      return { em: e.criado_em, tipo: e.tipo, rotulo, por: proposto ?? por };
    }),
  };
}

// ---------------------------------------------------------------- exportar (14.1)
const DATA_BR = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
// Data e hora de Brasília no formato da 14.1 (dd/mm/aaaa hh:mm); vazio sem data.
function dataBr(iso: string | null): string {
  return iso ? DATA_BR.format(new Date(iso)).replace(",", "") : "";
}
// Hoje em Brasília, como aaaa-mm-dd (nome do arquivo e pasta da exportação).
function hojeBr(): string {
  const [d, m, a] = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).split("/");
  return `${a}-${m}-${d}`;
}
// Uma célula do CSV: entre aspas quando precisa; e o que começa com =, +, - ou @ ganha um
// apóstrofo, para a planilha não executar o texto do candidato como fórmula.
function celula(v: string): string {
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

// Pasta de exportações de um dia (a faxina apaga as dos dias anteriores, decisão 6 do 8.5).
export function pastaDeExportacoes(dia: string): string {
  return `exportacoes/${dia}/`;
}

// Gera o CSV da 14.1 de uma vaga, com os mesmos filtros de listar_candidaturas, guarda no
// armazenamento e devolve um link de 5 min. Só recrutador ou administrador (o avaliador não
// exporta). Evento candidaturas_exportadas com a contagem. Recebe: contexto, vaga e filtros.
export async function exportApplications(ctx: ContextoVagas, vagaId: string, filtros: Omit<FiltrosCandidaturas, "vaga_id">) {
  if (visaoRestrita(ctx)) throw new DomainError("sem_permissao", 403);
  const vaga = await getJob(ctx, vagaId);
  const ids: string[] = [];
  for (let inicio = 0; ids.length < EXPORTACAO_MAX; inicio += 500) {
    const r = await listApplications(ctx, { ...filtros, vaga_id: vaga.id }, { inicio, limite: 500 });
    ids.push(...r.itens.map((i) => i.id));
    if (!r.mais) break;
  }
  const linhas: LinhaCandidatura[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db().from("rs_candidaturas").select(CAMPOS_CANDIDATURA).eq("empresa_id", ctx.empresa.id).in("id", ids.slice(i, i + 200));
    if (error) throw error;
    linhas.push(...(data as unknown as LinhaCandidatura[]));
  }
  const ordem = new Map(ids.map((id, i) => [id, i]));
  linhas.sort((a, b) => ordem.get(a.id)! - ordem.get(b.id)!);
  const etapas = new Map(vaga.etapas.map((e) => [e.id, e.nome]));
  const f = copy.funil;
  const cabecalho = ["nome", "email", "telefone", "linkedin", "cidade", "etapa", "situacao", "sinalizada", "origem", "candidatou_em",
    "movida_em", "encerrada_em", "avaliacoes", ...vaga.perguntas.map((p) => p.texto)];
  const corpo = linhas.map((c) => {
    const contagem = new Map<string, number>();
    for (const a of c.rs_avaliacoes) contagem.set(a.recomendacao, (contagem.get(a.recomendacao) ?? 0) + 1);
    const avaliacoes = (["forte_sim", "sim", "nao", "forte_nao"] as const).filter((r) => contagem.has(r)).map((r) => `${contagem.get(r)} ${f.recomendacoesCsv[r]}`).join(", ");
    return [
      c.candidato.nome, c.candidato.email ?? "", c.candidato.telefone ?? "", c.candidato.linkedin_url ?? "", c.candidato.cidade ?? "",
      c.etapa_id ? etapas.get(c.etapa_id) ?? "" : "", f.situacoes[c.situacao] ?? c.situacao, c.sinalizada ? f.sim : f.nao,
      f.origens[c.origem] ?? c.origem, dataBr(c.recebida_em), dataBr(c.movida_em), dataBr(c.encerrada_em), avaliacoes,
      ...vaga.perguntas.map((p) => c.rs_respostas.find((r) => r.pergunta_id === p.id)?.valor ?? ""),
    ].map(celula).join(";");
  });
  const csv = "﻿" + [cabecalho.map(celula).join(";"), ...corpo].join("\r\n") + "\r\n";
  const dia = hojeBr();
  const path = `${pastaDeExportacoes(dia)}${ctx.empresa.id}/${randomUUID()}.csv`;
  await storage().write(path, new TextEncoder().encode(csv), "text/csv; charset=utf-8");
  const nome = `candidaturas-${vaga.slug}-${dia}.csv`;
  const link = await storage().createDownloadUrl(path, DOWNLOAD_URL_SEGUNDOS, nome);
  const { error } = await db().rpc("rs_fn_registra_evento", {
    p_empresa: ctx.empresa.id, p_vaga: vaga.id, p_candidatura: null as never, p_tipo: "candidaturas_exportadas",
    p_ator: atorJson(ctx.ator), p_origem: "web", p_dados: { vaga_id: vaga.id, n: linhas.length } as never,
  });
  if (error) throw error;
  return { arquivo: nome, n: linhas.length, url: link.url, expira_em: link.expiresAt.toISOString() };
}

// Faxina (decisão 6 do 8.5): apaga as exportações dos 7 dias anteriores a hoje. Devolve quantas
// pastas foram varridas.
export async function cleanOldExports(agora = new Date()): Promise<number> {
  let n = 0;
  for (let d = 1; d <= 7; d++) {
    const dia = new Date(agora.getTime() - d * 86_400_000);
    const [dd, mm, aa] = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(dia).split("/");
    await storage().deletePrefix(pastaDeExportacoes(`${aa}-${mm}-${dd}`));
    n++;
  }
  return n;
}
