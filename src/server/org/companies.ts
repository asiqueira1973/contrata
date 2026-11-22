// Empresas — regra 11.33 (quem cria), 11.20 (slug) e 7.5 (rs_fn_cria_empresa). Criar empresa não
// tem porta de API nem MCP (administração da instância, 13.2). Configurar, excluir e desfazer
// (8.9; 7.4, 11.12, 11.20, 15.5) são do administrador, pelo formulário do chat; o banco confere o
// papel e as faixas de novo.
import "server-only";
import { invalidarPaginas } from "@/server/recruiting/jobs";
import type { z } from "zod";
import { slugProblem, type criarEmpresaSchema } from "@/lib/schemas/org";
import type { Papel } from "@/lib/limits";
import { canCreateCompany } from "@/server/auth/allowlist";
import { db } from "@/server/db/client";
import type { Usuario } from "@/server/db/users";
import { CamposInvalidos, DomainError } from "@/server/http";
import { contrasteComBranco, corValida } from "@/lib/cor";
import { COR_CONTRASTE_MIN, EMPRESA_NOME_MAX, EMPRESA_NOME_MIN, FUSO, RETENCAO_DIAS_MAX, RETENCAO_DIAS_MIN, TALENTOS_MESES_MAX, TALENTOS_MESES_MIN } from "@/lib/limits";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { enqueue } from "@/server/email/outbox";
import { empresaExcluida } from "@/server/email/templates";
import { confereLogo, urlDoLogo, type Logo } from "@/server/files/logo";
import { storage } from "@/server/files/storage";
import { atorJson } from "@/server/org/actor";
import { versaoDoAviso } from "@/server/recruiting/applications";

const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });

export type EmpresaDoUsuario = { slug: string; nome: string; papel: Papel };

// Empresas em que o usuário é membro ativo (consentimento do conector, 6.4). Recebe: id do usuário.
export async function listCompaniesForUser(usuarioId: string): Promise<EmpresaDoUsuario[]> {
  const { data, error } = await db()
    .from("rs_membros")
    .select("papel, rs_empresas!inner(slug, nome, excluida_em, suspensa_em)")
    .eq("usuario_id", usuarioId)
    .is("removido_em", null)
    .is("rs_empresas.excluida_em", null)
    .is("rs_empresas.suspensa_em", null);
  if (error) throw error;
  return (data ?? [])
    .map((m) => ({ slug: m.rs_empresas.slug, nome: m.rs_empresas.nome, papel: m.papel }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// O slug está livre? Recebe: slug já normalizado. Devolve: null se livre, ou o código do problema.
export async function slugStatus(slug: string): Promise<"slug_invalido" | "slug_em_uso" | null> {
  const problem = slugProblem(slug);
  if (problem) return problem;
  const { count, error } = await db().from("rs_empresas").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (error) throw error;
  return count ? "slug_em_uso" : null;
}

// Cria a empresa (8.1): confere a lista CRIACAO_EMPRESA_EMAILS (11.33) e o slug (11.20), depois
// rs_fn_cria_empresa cria empresa, administrador e pessoa, com o evento, numa transação.
// Recebe: o usuário logado e os dados validados. Devolve: id e slug.
export async function createCompany(usuario: Usuario, input: z.infer<typeof criarEmpresaSchema>) {
  if (!canCreateCompany(usuario.email)) throw new DomainError("sem_permissao_criar_empresa", 403);
  const problem = slugProblem(input.slug);
  if (problem) throw new DomainError(problem, problem === "slug_em_uso" ? 409 : 422);
  const { data, error } = await db().rpc("rs_fn_cria_empresa", {
    p_usuario: usuario.id,
    p_slug: input.slug,
    p_nome: input.nome,
    p_email_contato: input.email_contato,
  });
  if (error) {
    // Corrida entre duas criações com o mesmo slug: o índice único decide.
    if (error.code === "23505") throw new DomainError("slug_em_uso", 409);
    throw error;
  }
  return { id: data as string, slug: input.slug };
}

// Publica ou tira do ar a página de carreiras (8.3; pelo rs_fn_salva_empresa desde o 8.9, com o
// evento empresa_editada). Recebe: contexto e se publica.
export async function setCareersPagePublished(ctx: ContextoMembro, publicada: boolean): Promise<void> {
  await saveCompany(ctx, { pagina_publicada: publicada });
}

// ---------------------------------------------------------------- configurar (8.9)
export type ConfigEmpresa = {
  nome: string; slug: string; descricao: string | null; site_url: string | null; email_contato: string; cor_destaque: string | null;
  logo_url: string | null; pagina_publicada: boolean; retencao_dias: number; talentos_meses: number; mensagens_agente: "confirmar" | "direto";
  aviso_privacidade_extra: string | null; excluida_em: string | null;
};
export type MudancaEmpresa = Partial<{
  nome: string; descricao: string; site_url: string; email_contato: string; cor_destaque: string; pagina_publicada: boolean;
  retencao_dias: number; talentos_meses: number; mensagens_agente: "confirmar" | "direto"; aviso_privacidade_extra: string;
}>;

// Configuração da empresa (o que o formulário e quem_sou_eu mostram). Recebe: id. Devolve a config.
export async function companySettings(empresaId: string): Promise<ConfigEmpresa> {
  const { data: e, error } = await db().from("rs_empresas")
    .select("nome, slug, descricao, site_url, email_contato, cor_destaque, logo_path, pagina_publicada, retencao_dias, talentos_meses, mensagens_agente, aviso_privacidade_extra, excluida_em")
    .eq("id", empresaId).single();
  if (error) throw error;
  const { logo_path, ...resto } = e;
  return { ...resto, logo_url: urlDoLogo(e.slug, logo_path) };
}

const exigeAdministrador = (ctx: ContextoMembro) => {
  if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
};

// Confere o que o banco não confere: contraste da cor (11.20) e o e-mail. As faixas e o https
// viram campo inválido aqui, antes do check do banco, para o formulário marcar o campo certo.
function confere(d: MudancaEmpresa) {
  const erros: { campo: string; codigo: string }[] = [];
  if (d.cor_destaque && (!corValida(d.cor_destaque) || contrasteComBranco(d.cor_destaque) < COR_CONTRASTE_MIN)) erros.push({ campo: "cor_destaque", codigo: "cor_sem_contraste" });
  if (d.site_url && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(d.site_url)) erros.push({ campo: "site_url", codigo: "site_invalido" });
  if (d.retencao_dias !== undefined && (d.retencao_dias < RETENCAO_DIAS_MIN || d.retencao_dias > RETENCAO_DIAS_MAX)) erros.push({ campo: "retencao_dias", codigo: "retencao_invalida" });
  if (d.talentos_meses !== undefined && (d.talentos_meses < TALENTOS_MESES_MIN || d.talentos_meses > TALENTOS_MESES_MAX)) erros.push({ campo: "talentos_meses", codigo: "talentos_invalido" });
  if (d.nome !== undefined && (d.nome.trim().length < EMPRESA_NOME_MIN || d.nome.trim().length > EMPRESA_NOME_MAX)) erros.push({ campo: "nome", codigo: "campo_invalido" });
  if (d.email_contato !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email_contato)) erros.push({ campo: "email_contato", codigo: "email_invalido" });
  if (erros.length) throw new CamposInvalidos(erros);
}

// Grava o que mudou (só o que veio). Texto extra do aviso novo leva a versão (15.5) para o histórico.
// Recebe: contexto e mudanças. Devolve os campos mudados.
export async function saveCompany(ctx: ContextoMembro, d: MudancaEmpresa): Promise<string[]> {
  exigeAdministrador(ctx);
  confere(d);
  // O texto extra vai sem espaços nem quebras nas pontas (o mesmo trim da versão, 15.5); o que
  // sai fica no histórico com a versão dele.
  const dados = d.aviso_privacidade_extra === undefined ? d : { ...d, aviso_privacidade_extra: d.aviso_privacidade_extra.trim() };
  const extra = dados.aviso_privacidade_extra;
  const anterior = extra === undefined ? null : (await companySettings(ctx.empresa.id)).aviso_privacidade_extra;
  const { data, error } = await db().rpc("rs_fn_salva_empresa", {
    p_empresa: ctx.empresa.id, p_dados: dados as never, p_versao_aviso: (extra ? versaoDoAviso(extra) : null) as never, p_ator: atorJson(ctx.ator),
    p_versao_anterior: (anterior ? versaoDoAviso(anterior) : null) as never,
  });
  if (error) throw error;
  invalidarPaginas(ctx.empresa.slug);
  return (data as string[]) ?? [];
}

// Troca o logo (bytes já conferidos e, se SVG, limpos) ou remove (null). O arquivo antigo sai do
// bucket depois que o banco aceitou. Recebe: contexto e o logo (ou null).
export async function saveLogo(ctx: ContextoMembro, bytes: Uint8Array | null): Promise<void> {
  exigeAdministrador(ctx);
  let logo: Logo | null = null;
  if (bytes) {
    const r = confereLogo(bytes);
    if (typeof r === "string") throw new CamposInvalidos([{ campo: "logo", codigo: r }]);
    logo = r;
  }
  const path = logo ? `${ctx.empresa.id}/logo-${logo.sha256.slice(0, 8)}.${logo.ext}` : null;
  if (logo && path) await storage().write(path, logo.bytes, logo.mime);
  const { data, error } = await db().rpc("rs_fn_troca_logo", {
    p_empresa: ctx.empresa.id, p_path: path as never, p_mime: (logo?.mime ?? null) as never, p_bytes: (logo?.bytes.length ?? null) as never,
    p_sha256: (logo?.sha256 ?? null) as never, p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  if (data && data !== path) await storage().delete(data as string).catch(() => console.error("arquivo_nao_apagado"));
  invalidarPaginas(ctx.empresa.slug);
}

// Exclui a empresa (7.4): slug digitado, sem candidatura em andamento; páginas saem na hora e os
// administradores recebem o e-mail com o prazo e como desfazer. Recebe: contexto e o slug digitado.
// Devolve a data do expurgo.
export async function deleteCompany(ctx: ContextoMembro, slugDigitado: string): Promise<{ expurgar_em: string }> {
  exigeAdministrador(ctx);
  const { data, error } = await db().rpc("rs_fn_exclui_empresa", { p_empresa: ctx.empresa.id, p_slug: slugDigitado.trim(), p_ator: atorJson(ctx.ator) });
  if (error?.message === "empresa_com_ativas") throw new DomainError("empresa_com_ativas", 409);
  if (error?.message === "slug_nao_confere") throw new CamposInvalidos([{ campo: "confirmacao", codigo: "slug_nao_confere" }]);
  if (error) throw error;
  const r = data as { expurgar_em: string };
  invalidarPaginas(ctx.empresa.slug);
  const { data: adms } = await db().from("rs_membros").select("id, usuario:usuario_id(email)").eq("empresa_id", ctx.empresa.id)
    .eq("papel", "administrador").is("removido_em", null).not("usuario_id", "is", null);
  const m = empresaExcluida({ empresa: ctx.empresa.nome, data: DATA.format(new Date(r.expurgar_em)) });
  for (const a of (adms ?? []) as unknown as { id: string; usuario: { email: string } | null }[]) {
    if (!a.usuario) continue;
    await enqueue({ empresaId: ctx.empresa.id, tipo: "empresa_excluida", destinatario: a.usuario.email, chave: `empresa_excluida:${ctx.empresa.id}:${r.expurgar_em}:${a.id}`,
      assunto: m.assunto, html: m.html, texto: m.texto });
  }
  return r;
}

// Desfaz a exclusão (7.4) dentro de 7 dias. Recebe: contexto.
export async function restoreCompany(ctx: ContextoMembro): Promise<void> {
  exigeAdministrador(ctx);
  const { error } = await db().rpc("rs_fn_desfaz_exclusao", { p_empresa: ctx.empresa.id, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
  invalidarPaginas(ctx.empresa.slug);
}
