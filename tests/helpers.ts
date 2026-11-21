// Ajudantes dos testes de rota (seção 22): usuários, empresas e membros de teste no Supabase local,
// e requisições com sessão. Cada teste cria os próprios dados e apaga com cleanup() no afterAll
// (o banco local é compartilhado entre arquivos; nunca se apaga "tudo").
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { Papel } from "@/lib/limits";
import { signSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generateCredential } from "@/server/credentials/keys";
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

// ---------------------------------------------------------------- 8.2: conector e API v1

// Cria um token do conector (credencial mcp) para um membro, direto no banco. Devolve o valor.
export async function createTestToken(empresaId: string, membroId: string, escopos: ("leitura" | "escrita" | "decisao")[] = ["leitura", "escrita", "decisao"]) {
  const k = generateCredential("mcp");
  const { error } = await db().from("rs_credenciais").insert({ empresa_id: empresaId, tipo: "mcp", nome: "Teste", prefixo: k.prefixo, valor_hash: k.hash, escopos, membro_id: membroId, criada_por_membro_id: membroId });
  if (error) throw error;
  return k.valor;
}

// Cria uma chave de API da empresa, direto no banco. Devolve o valor.
export async function createTestApiKey(empresaId: string, criadaPor: string, escopos: ("leitura" | "escrita" | "decisao")[] = ["leitura"]) {
  const k = generateCredential("api");
  const { error } = await db().from("rs_credenciais").insert({ empresa_id: empresaId, tipo: "api", nome: "Chave teste", prefixo: k.prefixo, valor_hash: k.hash, escopos, criada_por_membro_id: criadaPor });
  if (error) throw error;
  return k.valor;
}

// Capacidades do cliente na revisão 2026-07-28 (13.5): com formulário, sem, ou sem dizer.
export const COM_UI = { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } };
export const SEM_UI = { extensions: {} };

let rpcId = 0;
// Chama /mcp com JSON-RPC. Recebe: token, método, params e as capacidades do cliente (ou null).
// Devolve: o status HTTP e o corpo JSON-RPC (lido de JSON ou de SSE).
export async function mcpRpc(token: string | null, method: string, params: Record<string, unknown> = {}, caps: unknown = COM_UI) {
  const { POST } = await import("@/app/mcp/route");
  const meta = caps === null ? {} : { _meta: { "io.modelcontextprotocol/clientCapabilities": caps } };
  const req = new NextRequest(`${SITE}/mcp`, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params: { ...params, ...meta } }),
  });
  const res = await POST(req);
  const text = await res.text();
  const data = text.startsWith("event:") || text.includes("\ndata:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text;
  return { status: res.status, headers: res.headers, body: data ? JSON.parse(data) : null };
}

// Chama uma ferramenta e devolve o result ({content, structuredContent, isError}) ou lança o erro JSON-RPC.
export async function callTool(token: string, name: string, args: Record<string, unknown> = {}, caps: unknown = COM_UI) {
  const r = await mcpRpc(token, "tools/call", { name, arguments: args }, caps);
  if (r.body?.error) return { rpcError: r.body.error as { code: number; message: string } };
  return r.body.result as { content: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
}

// Lista as ferramentas visíveis para um token, com as capacidades dadas.
export async function listTools(token: string, caps: unknown = COM_UI) {
  const r = await mcpRpc(token, "tools/list", {}, caps);
  return r.body.result.tools as { name: string; title?: string; annotations?: Record<string, unknown>; _meta?: { ui?: { visibility?: string[]; resourceUri?: string } } }[];
}

// Cria e publica uma vaga com a página da empresa publicada (8.4). Devolve: id e slug da vaga.
export async function createPublishedJob(empresa: { id: string; adminMembroId: string }, extra: Record<string, unknown> = {}) {
  const ator = { tipo: "membro", membro_id: empresa.adminMembroId };
  await db().from("rs_empresas").update({ pagina_publicada: true }).eq("id", empresa.id);
  const { data, error } = await db().rpc("rs_fn_cria_vaga", {
    p_empresa: empresa.id,
    p_dados: { titulo: `Vaga ${randomUUID().slice(0, 6)}`, modelo_trabalho: "remoto", descricao: "Descrição da vaga com mais de cinquenta caracteres para publicar.", etapas: [{ nome: "Triagem", tipo: "triagem" }, { nome: "Entrevista", tipo: "entrevista" }], ...extra } as never,
    p_alcance: { tipo: "todas" } as never, p_ator: ator, p_chave: null as unknown as string,
  });
  if (error) throw error;
  const id = (data as { id: string }).id;
  const { error: e2 } = await db().rpc("rs_fn_transicao_vaga", { p_vaga: id, p_empresa: empresa.id, p_para: "publicada", p_motivo: null as never, p_alcance: { tipo: "todas" } as never, p_ator: ator, p_max_publicadas: 50 });
  if (e2) throw e2;
  const { data: v } = await db().from("rs_vagas").select("slug").eq("id", id).single();
  return { id, slug: v!.slug };
}

// Sobe bytes para uma URL de upload do driver local (o que o navegador faz com o PUT).
export async function uploadTo(url: string, bytes: Uint8Array, contentType = "application/pdf") {
  const { PUT } = await import("@/app/api/dev/arquivos/[...caminho]/route");
  const u = new URL(url);
  const caminho = u.pathname.replace("/api/dev/arquivos/", "").split("/").map(decodeURIComponent);
  return PUT(new NextRequest(url, { method: "PUT", body: Buffer.from(bytes), headers: { "content-type": contentType } }), { params: Promise.resolve({ caminho }) });
}

// Cria e conclui uma candidatura direto pelas funções do banco (8.5), sem currículo. Respostas:
// [{pergunta_id, valor}]. Devolve: o id.
export async function createReceivedApplication(empresaId: string, vagaId: string, pessoa: { nome: string; email: string }, respostas: { pergunta_id: string; valor: string }[] = []) {
  const ator = { tipo: "candidato", origem: "publico" };
  const { data, error } = await db().rpc("rs_fn_cria_candidatura", {
    p_empresa: empresaId, p_vaga: vagaId, p_candidato: pessoa as never, p_respostas: respostas as never, p_origem: "pagina",
    p_ator: ator as never, p_consentimento: "2026-11-20", p_talentos: false, p_token_hash: `t-${randomUUID()}`, p_max_por_vaga: 10000,
  });
  if (error) throw error;
  const id = (data as { id: string }).id;
  const { error: e2 } = await db().rpc("rs_fn_conclui_candidatura", {
    p_candidatura: id, p_empresa: empresaId, p_arquivo: null as never, p_mensagem: { assunto: "Recebemos", corpo: "Acompanhe: {{link_acompanhamento}}" } as never,
    p_notificacao: { tipo: "candidatura_recebida", destinatario: pessoa.email, chave: `rec:${id}`, assunto: "Recebemos", html: "<p>x</p>", texto: "x" } as never,
    p_ator: ator as never, p_token_hash: `f-${randomUUID()}`,
  });
  if (e2) throw e2;
  return id;
}
