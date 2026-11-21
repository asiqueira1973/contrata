// Vagas — domínio do épico 8.3 (seções 7.3, 11.1, 11.11, 11.32 e 12.1). Uma regra, quatro portas:
// o formulário (salvar_vaga, publicar_vaga…), o fallback, a API v1 e a faxina chamam estas funções.
// Toda escrita recebe o ator; toda leitura e escrita recebe o alcance (seção 18). O banco confere
// de novo alcance, máquina 12.1 e congelamento (migration rs_vagas). Vaga fora do alcance some
// (nao_encontrado), como se não existisse (11.32).
import "server-only";
import { revalidateTag } from "next/cache";
import { CANDIDATURA_PARADA_DIAS, ETAPAS_PADRAO, VAGAS_PUBLICADAS_MAX } from "@/lib/limits";
import { camposDoErro, faltasParaPublicar, vagaSchema, type VagaEntrada } from "@/lib/schemas/jobs";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { CamposInvalidos, DomainError } from "@/server/http";
import { atorJson, type Ator } from "@/server/org/actor";
import type { Alcance } from "@/server/org/scope";

type Enums = Database["public"]["Enums"];
export type StatusVaga = Enums["rs_status_vaga"];
export type MotivoEncerramento = Enums["rs_motivo_encerramento_vaga"];

// O que toda função de vaga precisa: a empresa, quem age e o que essa pessoa enxerga. Serve ao
// membro (formulário, consulta) e à chave de API (alcance todas, 13.2).
export type ContextoVagas = { empresa: { id: string; slug: string }; ator: Ator; alcance: Alcance };

export type VagaDetalhe = {
  id: string;
  slug: string;
  titulo: string;
  status: StatusVaga;
  descricao: string;
  requisitos: string | null;
  area: { id: string; nome: string } | null;
  dono: { id: string; nome: string; com_acesso: boolean; recebe_resumo: boolean } | null;
  modelo_trabalho: Enums["rs_modelo_trabalho"];
  cidade: string | null;
  uf: string | null;
  regime: Enums["rs_regime"];
  salario_min: number | null;
  salario_max: number | null;
  salario_periodo: "mes" | "hora" | null;
  mostrar_salario: boolean;
  curriculo_obrigatorio: boolean;
  encerra_em: string | null;
  publicada_em: string | null;
  encerrada_em: string | null;
  motivo_encerramento: MotivoEncerramento | null;
  criado_em: string;
  atualizado_em: string;
  etapas: { id: string; nome: string; tipo: Enums["rs_tipo_etapa"]; ordem: number }[];
  perguntas: { id: string; ordem: number; texto: string; tipo: Enums["rs_tipo_pergunta"]; opcoes: string[]; obrigatoria: boolean; resposta_esperada: string | null }[];
  equipe: { membro_id: string; nome: string | null; papel_na_vaga: Enums["rs_papel_na_vaga"] }[];
};

export type VagaNaLista = {
  id: string;
  slug: string;
  titulo: string;
  status: StatusVaga;
  area: { id: string; nome: string } | null;
  dono: { id: string; nome: string } | null;
  modelo_trabalho: Enums["rs_modelo_trabalho"];
  cidade: string | null;
  uf: string | null;
  publicada_em: string | null;
  encerra_em: string | null;
  atualizado_em: string;
  candidaturas_ativas: number;
};

export type FiltrosVagas = { area_id?: string; dono_pessoa_id?: string; status?: StatusVaga; atualizada_desde?: string };

// Alcance no formato que as funções SQL esperam (p_alcance).
export function alcanceJson(alcance: Alcance) {
  if (alcance.tipo === "areas") return { tipo: "areas", area_ids: alcance.areaIds };
  if (alcance.tipo === "equipe") return { tipo: "equipe", membro_id: alcance.membroId };
  return { tipo: "todas" };
}

// Tira do cache a página de carreiras e as vagas da empresa (seção 17: cache de 60 s revalidado
// ao editar). Fora de uma requisição do Next (testes, scripts) não há cache a limpar.
export function invalidarPaginas(empresaSlug: string): void {
  try {
    revalidateTag(`carreiras:${empresaSlug}`, { expire: 0 });
  } catch {
    // sem contexto de requisição: nada em cache
  }
}

// Valida com o schema da 11.1 (o mesmo das três portas). Devolve os dados ou lança CamposInvalidos.
export function validarVaga(entrada: unknown): VagaEntrada {
  const r = vagaSchema.safeParse(entrada);
  if (!r.success) throw new CamposInvalidos(camposDoErro(r.error));
  return r.data;
}

// Etapas padrão para uma vaga nova (7.3).
export function etapasPadrao() {
  return ETAPAS_PADRAO.map((e) => ({ ...e }));
}

const SELECT_DETALHE =
  "id, slug, titulo, status, descricao, requisitos, modelo_trabalho, cidade, uf, regime, salario_min, salario_max, salario_periodo, " +
  "mostrar_salario, curriculo_obrigatorio, encerra_em, publicada_em, encerrada_em, motivo_encerramento, criado_em, atualizado_em, area_id, " +
  "area:area_id(id, nome), dono:dono_pessoa_id(id, nome, membro_id, recebe_resumo, membro:membro_id(removido_em, usuario_id)), " +
  "rs_etapas(id, nome, tipo, ordem), rs_perguntas(id, ordem, texto, tipo, opcoes, obrigatoria, resposta_esperada), " +
  "rs_vaga_equipe(membro_id, papel_na_vaga, rs_membros(rs_usuarios(nome)))";

type LinhaDetalhe = {
  id: string; slug: string; titulo: string; status: StatusVaga; descricao: string; requisitos: string | null;
  modelo_trabalho: Enums["rs_modelo_trabalho"]; cidade: string | null; uf: string | null; regime: Enums["rs_regime"];
  salario_min: number | null; salario_max: number | null; salario_periodo: string | null; mostrar_salario: boolean;
  curriculo_obrigatorio: boolean; encerra_em: string | null; publicada_em: string | null; encerrada_em: string | null;
  motivo_encerramento: MotivoEncerramento | null; criado_em: string; atualizado_em: string; area_id: string | null;
  area: { id: string; nome: string } | null;
  dono: { id: string; nome: string; membro_id: string | null; recebe_resumo: boolean; membro: { removido_em: string | null; usuario_id: string | null } | null } | null;
  rs_etapas: { id: string; nome: string; tipo: Enums["rs_tipo_etapa"]; ordem: number }[];
  rs_perguntas: { id: string; ordem: number; texto: string; tipo: Enums["rs_tipo_pergunta"]; opcoes: string[] | null; obrigatoria: boolean; resposta_esperada: string | null }[];
  rs_vaga_equipe: { membro_id: string; papel_na_vaga: Enums["rs_papel_na_vaga"]; rs_membros: { rs_usuarios: { nome: string } | null } | null }[];
};

function paraDetalhe(v: LinhaDetalhe): VagaDetalhe {
  const comAcesso = !!(v.dono?.membro && !v.dono.membro.removido_em && v.dono.membro.usuario_id);
  return {
    id: v.id, slug: v.slug, titulo: v.titulo, status: v.status, descricao: v.descricao, requisitos: v.requisitos,
    area: v.area, dono: v.dono ? { id: v.dono.id, nome: v.dono.nome, com_acesso: comAcesso, recebe_resumo: v.dono.recebe_resumo } : null,
    modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf, regime: v.regime,
    salario_min: v.salario_min === null ? null : Number(v.salario_min), salario_max: v.salario_max === null ? null : Number(v.salario_max),
    salario_periodo: v.salario_periodo as "mes" | "hora" | null, mostrar_salario: v.mostrar_salario,
    curriculo_obrigatorio: v.curriculo_obrigatorio, encerra_em: v.encerra_em, publicada_em: v.publicada_em,
    encerrada_em: v.encerrada_em, motivo_encerramento: v.motivo_encerramento, criado_em: v.criado_em, atualizado_em: v.atualizado_em,
    etapas: [...v.rs_etapas].sort((a, b) => a.ordem - b.ordem),
    perguntas: [...v.rs_perguntas].sort((a, b) => a.ordem - b.ordem).map((p) => ({ ...p, opcoes: p.opcoes ?? [] })),
    equipe: v.rs_vaga_equipe.map((e) => ({ membro_id: e.membro_id, nome: e.rs_membros?.rs_usuarios?.nome ?? null, papel_na_vaga: e.papel_na_vaga })),
  };
}

// A vaga está no alcance? (11.32) Recebe: alcance, área da vaga e os membros da equipe.
function noAlcance(alcance: Alcance, areaId: string | null, equipe: string[]): boolean {
  if (alcance.tipo === "todas") return true;
  if (alcance.tipo === "areas") return !!areaId && alcance.areaIds.includes(areaId);
  return equipe.includes(alcance.membroId);
}

// Detalhe de uma vaga do alcance (ver_vaga, GET /vagas/{id}). Fora do alcance: nao_encontrado.
export async function getJob(ctx: ContextoVagas, id: string): Promise<VagaDetalhe> {
  const { data, error } = await db().from("rs_vagas").select(SELECT_DETALHE).eq("empresa_id", ctx.empresa.id).eq("id", id).maybeSingle();
  if (error) throw error;
  const v = data as unknown as LinhaDetalhe | null;
  if (!v || !noAlcance(ctx.alcance, v.area_id, v.rs_vaga_equipe.map((e) => e.membro_id))) throw new DomainError("nao_encontrado", 404);
  return paraDetalhe(v);
}

// Dados editáveis da vaga no formato de entrada (para juntar com o que mudou no PATCH e no PUT).
export function entradaDaVaga(v: VagaDetalhe): VagaEntrada {
  return {
    titulo: v.titulo, slug: v.slug, descricao: v.descricao, requisitos: v.requisitos, area_id: v.area?.id ?? null,
    dono_pessoa_id: v.dono?.id ?? null, modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf as VagaEntrada["uf"],
    regime: v.regime, salario_min: v.salario_min, salario_max: v.salario_max, salario_periodo: v.salario_periodo,
    mostrar_salario: v.mostrar_salario, curriculo_obrigatorio: v.curriculo_obrigatorio, encerra_em: v.encerra_em,
    etapas: v.etapas.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo })),
    perguntas: v.perguntas.map((p) => ({ texto: p.texto, tipo: p.tipo, opcoes: p.opcoes, obrigatoria: p.obrigatoria, resposta_esperada: p.resposta_esperada })),
    equipe: {
      responsavel: v.equipe.find((e) => e.papel_na_vaga === "responsavel")?.membro_id ?? null,
      avaliadores: v.equipe.filter((e) => e.papel_na_vaga === "avaliador").map((e) => e.membro_id),
    },
  };
}

// Lista as vagas do alcance com filtros (listar_vagas, GET /vagas), mais novas antes, paginadas
// por posição. Devolve os itens e se há mais.
export async function listJobs(ctx: ContextoVagas, filtros: FiltrosVagas, pagina: { inicio: number; limite: number }) {
  let q = db()
    .from("rs_vagas")
    .select("id, slug, titulo, status, modelo_trabalho, cidade, uf, publicada_em, encerra_em, atualizado_em, area:area_id(id, nome), dono:dono_pessoa_id(id, nome), rs_candidaturas(situacao)")
    .eq("empresa_id", ctx.empresa.id);
  if (ctx.alcance.tipo === "areas") {
    if (!ctx.alcance.areaIds.length) return { itens: [] as VagaNaLista[], mais: false };
    q = q.in("area_id", ctx.alcance.areaIds);
  } else if (ctx.alcance.tipo === "equipe") {
    const { data: eq, error } = await db().from("rs_vaga_equipe").select("vaga_id").eq("membro_id", ctx.alcance.membroId);
    if (error) throw error;
    const ids = (eq ?? []).map((e) => e.vaga_id);
    if (!ids.length) return { itens: [] as VagaNaLista[], mais: false };
    q = q.in("id", ids);
  }
  if (filtros.area_id) q = q.eq("area_id", filtros.area_id);
  if (filtros.dono_pessoa_id) q = q.eq("dono_pessoa_id", filtros.dono_pessoa_id);
  if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.atualizada_desde) q = q.gte("atualizado_em", filtros.atualizada_desde);
  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .order("id")
    .range(pagina.inicio, pagina.inicio + pagina.limite);
  if (error) throw error;
  const linhas = data ?? [];
  const itens: VagaNaLista[] = linhas.slice(0, pagina.limite).map((v) => ({
    id: v.id, slug: v.slug, titulo: v.titulo, status: v.status, area: v.area, dono: v.dono,
    modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf, publicada_em: v.publicada_em,
    encerra_em: v.encerra_em, atualizado_em: v.atualizado_em,
    candidaturas_ativas: (v.rs_candidaturas ?? []).filter((c) => c.situacao === "ativa").length,
  }));
  return { itens, mais: linhas.length > pagina.limite };
}

function erroDoBanco(e: { message?: string } | null): never {
  throw e;
}

// Cria a vaga em rascunho (12.1). Recebe: contexto, dados válidos (11.1) e a chave de
// idempotência (só a API v1). Devolve {id, criada}: criada=false quando a chave já existia.
export async function createJob(ctx: ContextoVagas, dados: VagaEntrada, chave: string | null = null) {
  const { data, error } = await db().rpc("rs_fn_cria_vaga", {
    p_empresa: ctx.empresa.id,
    p_dados: dados as never,
    p_alcance: alcanceJson(ctx.alcance) as never,
    p_ator: atorJson(ctx.ator),
    p_chave: chave as string,
  });
  if (error) {
    // Dois POST simultâneos com a mesma Idempotency-Key: o segundo bate no índice único e devolve
    // a vaga do primeiro (13.2), em vez de erro.
    if (chave && (error as { code?: string }).code === "23505") {
      const { data: v } = await db().from("rs_vagas").select("id").eq("empresa_id", ctx.empresa.id).eq("chave_idempotencia", chave).maybeSingle();
      if (v) return { id: v.id, criada: false };
    }
    erroDoBanco(error);
  }
  invalidarPaginas(ctx.empresa.slug);
  return data as { id: string; criada: boolean };
}

// Grava a vaga inteira (salvar_vaga, PATCH e PUT da API). `partes` diz o que regravar além dos
// dados: as etapas, as perguntas e a equipe só mudam quando pedidas (o PATCH não mexe nelas).
export async function saveJob(ctx: ContextoVagas, id: string, dados: VagaEntrada, partes: { etapas?: boolean; perguntas?: boolean; equipe?: boolean } = { etapas: true, perguntas: true, equipe: true }) {
  const { etapas, perguntas, equipe, ...base } = dados;
  const corpo: Record<string, unknown> = { ...base };
  if (partes.etapas) corpo.etapas = etapas;
  if (partes.perguntas) corpo.perguntas = perguntas;
  if (partes.equipe) corpo.equipe = equipe;
  const { error } = await db().rpc("rs_fn_salva_vaga", {
    p_vaga: id,
    p_empresa: ctx.empresa.id,
    p_dados: corpo as never,
    p_alcance: alcanceJson(ctx.alcance) as never,
    p_ator: atorJson(ctx.ator),
  });
  if (error) erroDoBanco(error);
  invalidarPaginas(ctx.empresa.slug);
}

// Muda o status (12.1). Publicar confere antes o que falta pela 11.1, campo por campo; o banco
// confere de novo. Encerrar exige motivo; com candidatura ativa, o banco recusa (vaga_com_ativas).
export async function transitionJob(ctx: ContextoVagas, id: string, para: StatusVaga, motivo: MotivoEncerramento | null = null) {
  if (para === "publicada") {
    const v = await getJob(ctx, id);
    const faltas = faltasParaPublicar(v);
    if (faltas.length) throw new CamposInvalidos(faltas);
  }
  const { error } = await db().rpc("rs_fn_transicao_vaga", {
    p_vaga: id,
    p_empresa: ctx.empresa.id,
    p_para: para,
    p_motivo: motivo as MotivoEncerramento,
    p_alcance: alcanceJson(ctx.alcance) as never,
    p_ator: atorJson(ctx.ator),
    p_max_publicadas: VAGAS_PUBLICADAS_MAX,
  });
  if (error) erroDoBanco(error);
  invalidarPaginas(ctx.empresa.slug);
}

// Resumo do funil (resumo_da_vaga, GET /vagas/{id}/resumo): candidaturas ativas por etapa,
// contagem por situação, sinalizadas, paradas há 14+ dias (11.11) e idade média das ativas em dias.
export async function jobSummary(ctx: ContextoVagas, id: string, agora = new Date()) {
  const v = await getJob(ctx, id);
  const { data, error } = await db().from("rs_candidaturas").select("etapa_id, situacao, sinalizada, movida_em, criado_em").eq("empresa_id", ctx.empresa.id).eq("vaga_id", id);
  if (error) throw error;
  const cands = data ?? [];
  const ativas = cands.filter((c) => c.situacao === "ativa");
  const limite = agora.getTime() - CANDIDATURA_PARADA_DIAS * 86_400_000;
  const situacoes: Record<string, number> = { ativa: 0, reprovada: 0, desistiu: 0, contratada: 0, encerrada_vaga: 0 };
  for (const c of cands) situacoes[c.situacao] = (situacoes[c.situacao] ?? 0) + 1;
  const idade = ativas.length ? ativas.reduce((s, c) => s + (agora.getTime() - new Date(c.criado_em).getTime()), 0) / ativas.length / 86_400_000 : null;
  return {
    vaga: { id: v.id, titulo: v.titulo, status: v.status },
    etapas: v.etapas.map((e) => ({ id: e.id, nome: e.nome, ativas: ativas.filter((c) => c.etapa_id === e.id).length })),
    situacoes,
    sinalizadas: ativas.filter((c) => c.sinalizada).length,
    paradas: ativas.filter((c) => new Date(c.movida_em).getTime() < limite).length,
    idade_media_dias: idade === null ? null : Math.round(idade * 10) / 10,
  };
}

// Faxina (11.11): pausa as vagas vencidas, em lotes. Devolve quantas pausou. Não há empresa aqui:
// o cache das páginas expira sozinho em 60 s (seção 17).
export async function pauseExpiredJobs(lote: number): Promise<number> {
  const { data, error } = await db().rpc("rs_fn_faxina_vagas_vencidas", { p_lote: lote });
  if (error) throw error;
  return data as number;
}
