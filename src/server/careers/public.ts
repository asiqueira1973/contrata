// Leitura pública da página de carreiras (seções 10.1, 13.2 e 17; regra 11.20). Só empresa com
// página publicada (pagina_publicada = true), não excluída nem suspensa; só o que é público da
// vaga (nunca dono, equipe, candidaturas ou dados internos). Sem cache aqui: as páginas embrulham
// estas funções em 'use cache' (src/app/[empresa]/dados.ts); a API pública usa Cache-Control.
import "server-only";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { markdownSeguro } from "./markdown";

type Enums = Database["public"]["Enums"];

export type EmpresaPublica = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  site_url: string | null;
  cor_destaque: string | null;
  pagina_publicada: boolean;
};

export type VagaPublica = {
  id: string;
  slug: string;
  titulo: string;
  status: Enums["rs_status_vaga"];
  descricao: string;
  descricao_html: string;
  requisitos: string | null;
  requisitos_html: string;
  area: string | null;
  modelo_trabalho: Enums["rs_modelo_trabalho"];
  cidade: string | null;
  uf: string | null;
  regime: Enums["rs_regime"];
  salario: { min: number | null; max: number | null; periodo: "mes" | "hora" } | null;
  curriculo_obrigatorio: boolean;
  encerra_em: string | null;
  publicada_em: string | null;
  atualizado_em: string;
};

// Empresa pela slug, publicada ou não (a pré-visualização assinada mostra a não publicada).
// Excluída ou suspensa: null. Recebe: slug. Devolve: a empresa ou null.
export async function empresaPorSlug(slug: string): Promise<EmpresaPublica | null> {
  const { data, error } = await db()
    .from("rs_empresas")
    .select("id, slug, nome, descricao, site_url, cor_destaque, pagina_publicada")
    .eq("slug", slug)
    .is("excluida_em", null)
    .is("suspensa_em", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Guardião da API pública e das páginas (seção 5): só empresa com página publicada.
export async function requireEmpresaPublica(slug: string): Promise<EmpresaPublica | null> {
  const e = await empresaPorSlug(slug);
  return e?.pagina_publicada ? e : null;
}

const CAMPOS =
  "id, slug, titulo, status, descricao, requisitos, modelo_trabalho, cidade, uf, regime, salario_min, salario_max, salario_periodo, " +
  "mostrar_salario, curriculo_obrigatorio, encerra_em, publicada_em, atualizado_em, area:area_id(nome)";

type Linha = {
  id: string; slug: string; titulo: string; status: Enums["rs_status_vaga"]; descricao: string; requisitos: string | null;
  modelo_trabalho: Enums["rs_modelo_trabalho"]; cidade: string | null; uf: string | null; regime: Enums["rs_regime"];
  salario_min: number | null; salario_max: number | null; salario_periodo: string | null; mostrar_salario: boolean;
  curriculo_obrigatorio: boolean; encerra_em: string | null; publicada_em: string | null; atualizado_em: string;
  area: { nome: string } | null;
};

function publica(v: Linha): VagaPublica {
  return {
    id: v.id, slug: v.slug, titulo: v.titulo, status: v.status, descricao: v.descricao, descricao_html: markdownSeguro(v.descricao),
    requisitos: v.requisitos, requisitos_html: markdownSeguro(v.requisitos), area: v.area?.nome ?? null,
    modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf, regime: v.regime,
    // Salário só se a empresa escolheu mostrar (7.3, 11.20).
    salario: v.mostrar_salario && v.salario_periodo
      ? { min: v.salario_min === null ? null : Number(v.salario_min), max: v.salario_max === null ? null : Number(v.salario_max), periodo: v.salario_periodo as "mes" | "hora" }
      : null,
    curriculo_obrigatorio: v.curriculo_obrigatorio, encerra_em: v.encerra_em, publicada_em: v.publicada_em, atualizado_em: v.atualizado_em,
  };
}

// Vagas publicadas da empresa (página de carreiras, feed, sitemap, API pública), mais novas antes.
// Pausada e encerrada saem da lista (12.1). Recebe: id da empresa.
export async function vagasPublicadas(empresaId: string): Promise<VagaPublica[]> {
  const { data, error } = await db().from("rs_vagas").select(CAMPOS).eq("empresa_id", empresaId).eq("status", "publicada").order("publicada_em", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Linha[]).map(publica);
}

// Uma vaga pela slug, para a página da vaga e a API pública. Publicada, pausada ou encerrada
// (a página responde 200 com "não recebe mais candidaturas"); rascunho não existe para o público.
export async function vagaPublica(empresaId: string, slug: string): Promise<VagaPublica | null> {
  const { data, error } = await db().from("rs_vagas").select(CAMPOS).eq("empresa_id", empresaId).eq("slug", slug).neq("status", "rascunho").maybeSingle();
  if (error) throw error;
  return data ? publica(data as unknown as Linha) : null;
}

// Empresas com página publicada e suas vagas publicadas, para o sitemap (seção 17).
export async function paginasParaSitemap(): Promise<{ slug: string; atualizado_em: string; vagas: { slug: string; atualizado_em: string }[] }[]> {
  const { data, error } = await db()
    .from("rs_empresas")
    .select("slug, atualizado_em, rs_vagas(slug, status, atualizado_em)")
    .eq("pagina_publicada", true)
    .is("excluida_em", null)
    .is("suspensa_em", null);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    slug: e.slug,
    atualizado_em: e.atualizado_em,
    vagas: (e.rs_vagas ?? []).filter((v) => v.status === "publicada").map((v) => ({ slug: v.slug, atualizado_em: v.atualizado_em })),
  }));
}
