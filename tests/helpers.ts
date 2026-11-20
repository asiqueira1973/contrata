// Ajudantes dos testes de rota (seção 22): usuários, empresas e membros de teste no Supabase local,
// e requisições com sessão. Cada teste cria os próprios dados e apaga com cleanup() no afterAll
// (o banco local é compartilhado entre arquivos; nunca se apaga "tudo").
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { Papel } from "@/lib/limits";
import { signSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { setMailerForTests, type EmailMessage } from "@/server/email/mailer";

export const SITE = "http://localhost:3050";

export type TestUser = { id: string; email: string; cookie: string };

const created = { usuarios: [] as string[], empresas: [] as string[] };

// Cria um usuário direto no banco. Recebe: e-mail (padrão único @teste.dev) e se já aceitou os
// Termos. Devolve: id, e-mail e o cookie de sessão pronto.
export async function createTestUser(opts: { email?: string; accepted?: boolean } = {}): Promise<TestUser> {
  const email = opts.email ?? `u-${randomUUID().slice(0, 8)}@teste.dev`;
  const { data, error } = await db()
    .from("rs_usuarios")
    .insert({ google_sub: `sub-${randomUUID()}`, email, nome: `Pessoa ${email.split("@")[0]}`, termos_aceitos_em: opts.accepted === false ? null : new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  created.usuarios.push(data.id);
  return { id: data.id, email, cookie: `rs_sessao=${await signSession(data.id)}` };
}

// Cria uma empresa com o dono como administrador (rs_fn_cria_empresa). Devolve: id, slug e o
// membro administrador.
export async function createTestCompany(owner: TestUser) {
  const slug = `t-${randomUUID().slice(0, 12)}`;
  const { data, error } = await db().rpc("rs_fn_cria_empresa", { p_usuario: owner.id, p_slug: slug, p_nome: `Empresa ${slug}`, p_email_contato: owner.email });
  if (error) throw error;
  created.empresas.push(data as string);
  const { data: m } = await db().from("rs_membros").select("id").eq("empresa_id", data as string).eq("usuario_id", owner.id).single();
  return { id: data as string, slug, adminMembroId: m!.id };
}

// Junta um usuário à empresa pelo caminho real (convite + aceite). Devolve: id do membro.
export async function addMember(empresa: { id: string; adminMembroId: string }, user: TestUser, papel: Papel, areas: string[] = []) {
  const { data, error } = await db().rpc("rs_fn_convida_membro", {
    p_empresa: empresa.id, p_email: user.email, p_papel: papel, p_todas_areas: areas.length === 0, p_areas: areas,
    p_token_hash: `h-${randomUUID()}`, p_expira_em: new Date(Date.now() + 86400_000).toISOString(), p_max_pendentes: 50,
    p_ator: { tipo: "membro", membro_id: empresa.adminMembroId },
  });
  if (error) throw error;
  const { error: e2 } = await db().rpc("rs_fn_aceita_convite", { p_membro: data as string, p_usuario: user.id });
  if (e2) throw e2;
  return data as string;
}

// Cria uma área. Devolve: id.
export async function createArea(empresa: { id: string; adminMembroId: string }, nome: string) {
  const { data, error } = await db().rpc("rs_fn_salva_area", {
    p_empresa: empresa.id, p_id: null as unknown as string, p_nome: nome, p_responsavel: null as unknown as string,
    p_ator: { tipo: "membro", membro_id: empresa.adminMembroId },
  });
  if (error) throw error;
  return data as string;
}

// Registra empresa criada por uma rota, para o cleanup.
export function trackCompany(id: string) {
  created.empresas.push(id);
}

// Apaga o que o arquivo criou: empresas pelo expurgo (a trilha é imutável fora dele, 7.4), depois
// os usuários.
export async function cleanup() {
  for (const id of created.empresas.splice(0)) {
    await db().from("rs_empresas").update({ excluida_em: new Date(Date.now() - 8 * 86400_000).toISOString() }).eq("id", id);
    await db().rpc("rs_fn_expurga_empresa", { p_empresa: id });
  }
  const ids = created.usuarios.splice(0);
  if (ids.length) await db().from("rs_usuarios").delete().in("id", ids);
}

// Monta uma requisição com cookie de sessão e Origin do site (20.3). origin: null tira o cabeçalho.
export function apiRequest(path: string, opts: { method?: string; cookie?: string; body?: unknown; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin !== null) headers.origin = opts.origin ?? SITE;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`${SITE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

// Contexto de rota do Next 16 (params como Promise).
export function params<T extends Record<string, string>>(p: T) {
  return { params: Promise.resolve(p) };
}

// Troca o envio de e-mail por uma caixa em memória. Devolve: a lista que recebe as mensagens.
export function captureEmails(): EmailMessage[] {
  const box: EmailMessage[] = [];
  setMailerForTests({ async send(m) { box.push(m); return { id: `teste-${box.length}` }; } });
  return box;
}
