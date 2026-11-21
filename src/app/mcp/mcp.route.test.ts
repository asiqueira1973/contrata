// /mcp (8.2; seções 6.3, 13.3 e 13.5): 401 com WWW-Authenticate; ferramentas por capacidade do
// cliente; visibilidade (salvar_* e opções só do app); anotações; escopo e papel; chave de API;
// fallback com prévia; chave criada só no formulário.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import {
  COM_UI, SEM_UI, addMember, callTool, captureEmails, cleanup, createTestApiKey, createTestCompany, createTestToken, createTestUser, listTools, mcpRpc,
} from "../../../tests/helpers";

captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let admin: string, leitura: string, chave: string;

beforeAll(async () => {
  const u = await createTestUser();
  empresa = await createTestCompany(u);
  admin = await createTestToken(empresa.id, empresa.adminMembroId);
  const r = await createTestUser();
  const m = await addMember(empresa, r, "recrutador");
  leitura = await createTestToken(empresa.id, m, ["leitura"]);
  chave = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
});
afterAll(cleanup);

describe("autenticação (6.3, 6.4)", () => {
  it("sem token ou com token inválido: 401 com WWW-Authenticate apontando os metadados", async () => {
    for (const tok of [null, "rsm_" + "x".repeat(43), "outro"]) {
      const r = await mcpRpc(tok, "tools/list");
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toBe('Bearer resource_metadata="http://localhost:3050/.well-known/oauth-protected-resource"');
      expect(r.body.codigo).toBe("credencial_invalida");
    }
  });
  it("token revogado deixa de valer na chamada seguinte", async () => {
    const t = await createTestToken(empresa.id, empresa.adminMembroId);
    expect((await mcpRpc(t, "tools/list")).status).toBe(200);
    await db().from("rs_credenciais").update({ revogada_em: new Date().toISOString() }).eq("prefixo", t.slice(0, 8)).eq("empresa_id", empresa.id);
    expect((await mcpRpc(t, "tools/list")).status).toBe(401);
  });
});

describe("ferramentas por capacidade do cliente (13.5) e visibilidade (princípios 2 e 6)", () => {
  it("cliente com MCP Apps: formulários, sem fallback; salvar_* e opções só do app; abrir_* do modelo", async () => {
    const tools = await listTools(admin, COM_UI);
    const nomes = tools.map((t) => t.name);
    expect(nomes.some((n) => n.startsWith("registrar_"))).toBe(false);
    for (const t of tools) {
      const vis = t._meta?.ui?.visibility;
      if (/^(salvar|opcoes)_/.test(t.name)) expect(vis, t.name).toEqual(["app"]);
      else expect(vis, t.name).toEqual(["model"]);
      if (t.name.startsWith("abrir_formulario_")) expect(t._meta?.ui?.resourceUri).toMatch(/^ui:\/\/contrata\/formulario-[0-9a-f]{12}\.html$/);
    }
    expect(nomes).toEqual(expect.arrayContaining(["abrir_formulario_convite", "salvar_convite", "abrir_formulario_conexoes", "salvar_conexoes"]));
  });
  it("cliente sem MCP Apps: só consultas e fallbacks, todos visíveis ao modelo; conexões, convite e acesso não têm fallback", async () => {
    const tools = await listTools(admin, SEM_UI);
    const nomes = tools.map((t) => t.name);
    expect(nomes.some((n) => /^(abrir_formulario|salvar|opcoes)_/.test(n))).toBe(false);
    expect(nomes).toEqual(expect.arrayContaining(["registrar_area", "registrar_pessoa"]));
    // Mexer em acesso só pelo clique (13.5, decisão de 20/11/2026): o modelo poderia confirmar sozinho.
    for (const n of ["registrar_conexoes", "registrar_convite", "registrar_acesso"]) expect(nomes).not.toContain(n);
    for (const t of tools) expect(t._meta?.ui?.visibility, t.name).toEqual(["model"]);
  });
  it("cliente que não diz: as duas formas", async () => {
    const nomes = (await listTools(admin, null)).map((t) => t.name);
    expect(nomes).toEqual(expect.arrayContaining(["abrir_formulario_area", "registrar_area"]));
  });
  it("toda ferramenta tem título e dicas; salvar_*, registrar_* e as operações (8.5) são escrita; openWorldHint sempre false", async () => {
    for (const t of await listTools(admin, null)) {
      expect(t.title, t.name).toBeTruthy();
      const formulario = /^(salvar|registrar)_/.test(t.name);
      const operacao = ["mover_etapa", "adicionar_nota"].includes(t.name);
      expect(t.annotations?.readOnlyHint, t.name).toBe(!(formulario || operacao));
      expect(t.annotations?.destructiveHint, t.name).toBe(formulario);
      expect(t.annotations?.openWorldHint, t.name).toBe(false);
    }
  });
});

describe("escopo efetivo (11.16) e chave de API no /mcp (6.3)", () => {
  it("token só com leitura: consultas e conexões, nenhum formulário de escrita", async () => {
    const nomes = (await listTools(leitura)).map((t) => t.name);
    expect(nomes).toContain("listar_pessoas");
    expect(nomes).toContain("abrir_formulario_conexoes");
    expect(nomes).not.toContain("salvar_pessoa");
  });
  it("a chave de API também funciona no /mcp, só com consultas (formulário precisa de uma pessoa)", async () => {
    const nomes = (await listTools(chave)).map((t) => t.name);
    expect(nomes).toEqual(expect.arrayContaining(["quem_sou_eu", "listar_areas"]));
    expect(nomes.some((n) => n.includes("formulario") || n.startsWith("salvar_"))).toBe(false);
    const r = await callTool(chave, "quem_sou_eu");
    expect("structuredContent" in r && r.structuredContent?.membro).toBeNull();
  });
});

describe("abrir formulário não grava (princípio 6)", () => {
  it("abrir_formulario_area devolve o formulário preenchido e nada muda no banco", async () => {
    const nome = `Área ${randomUUID().slice(0, 6)}`;
    const r = await callTool(admin, "abrir_formulario_area", { nome });
    expect("structuredContent" in r && r.structuredContent?.acao).toBe("area");
    expect("structuredContent" in r && (r.structuredContent?.valores as Record<string, unknown>).nome).toBe(nome);
    expect("content" in r && r.content[0].text).toContain("Nada foi gravado");
    const { count } = await db().from("rs_areas").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("nome", nome);
    expect(count).toBe(0);
  });
});

describe("fallback com prévia (13.5)", () => {
  it("primeira chamada não grava e devolve o token; a segunda, com os mesmos dados, grava", async () => {
    const nome = `Fallback ${randomUUID().slice(0, 6)}`;
    const previa = await callTool(admin, "registrar_area", { operacao: "criar", nome }, SEM_UI);
    const token = "structuredContent" in previa ? (previa.structuredContent?.token_previa as string) : "";
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    const antes = await db().from("rs_areas").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("nome", nome);
    expect(antes.count).toBe(0);
    const outro = await callTool(admin, "registrar_area", { operacao: "criar", nome: `${nome} X`, confirmar: true, token_previa: token }, SEM_UI);
    expect("content" in outro && outro.content[0].text).toBe("Os dados mudaram desde a prévia. Mostre a nova prévia à pessoa.");
    const outroToken = await createTestToken(empresa.id, empresa.adminMembroId);
    const deOutro = await callTool(outroToken, "registrar_area", { operacao: "criar", nome, confirmar: true, token_previa: token }, SEM_UI);
    expect("isError" in deOutro && deOutro.isError).toBe(true);
    const ok = await callTool(admin, "registrar_area", { operacao: "criar", nome, confirmar: true, token_previa: token }, SEM_UI);
    expect("structuredContent" in ok && ok.structuredContent?.ok).toBe(true);
    const { data } = await db().from("rs_eventos").select("origem, ator_tipo").eq("empresa_id", empresa.id).eq("tipo", "area_criada").order("id", { ascending: false }).limit(1).single();
    expect(data).toEqual({ origem: "mcp", ator_tipo: "agente" });
  });
  it("token malformado ou vencido não grava", async () => {
    const r = await callTool(admin, "registrar_area", { operacao: "criar", nome: "Qualquer", confirmar: true, token_previa: "1.abc" }, SEM_UI);
    expect("content" in r && r.content[0].text).toBe("A prévia venceu ou não é válida. Gere uma nova prévia e mostre à pessoa.");
  });
  it("dar acesso pelo fallback é recusado já na prévia, sem token e sem convite (decisão de 20/11/2026)", async () => {
    const { data: p } = await db().from("rs_pessoas").insert({ empresa_id: empresa.id, nome: "Sem Acesso", email: `sem-${randomUUID()}@teste.exemplo` }).select("id").single();
    const r = await callTool(admin, "registrar_pessoa", { operacao: "dar_acesso", pessoa: p!.id, papel: "administrador", todas: "todas" }, SEM_UI);
    expect("content" in r && r.content[0].text).toBe("Isso só pode ser feito pelo formulário, com o clique da pessoa. Use o Contrata no Claude ou no ChatGPT.");
    expect(JSON.stringify(r)).not.toContain("token_previa");
    const { count } = await db().from("rs_membros").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("papel", "administrador").is("usuario_id", null);
    expect(count).toBe(0);
  });
});

describe("chave de API criada pelo formulário (6.3, 11.15)", () => {
  it("o valor aparece só no structuredContent (para o formulário), nunca no texto; o banco guarda só o hash", async () => {
    const r = await callTool(admin, "salvar_conexoes", { operacao: "criar_chave", nome: "n8n", escopos: ["escrita"] });
    const sc = "structuredContent" in r ? r.structuredContent! : {};
    const valor = (sc.segredo as { valor: string }).valor;
    expect(valor).toMatch(/^rsk_[A-Za-z0-9_-]{43}$/);
    expect("content" in r && r.content.map((c) => c.text).join(" ")).not.toContain(valor);
    expect(sc.resumo).not.toContain(valor);
    const { data } = await db().from("rs_credenciais").select("escopos, valor_hash, prefixo").eq("id", (sc.ids as string[])[0]).single();
    expect(data!.escopos).toEqual(["leitura", "escrita"]);
    expect(data!.valor_hash).not.toContain(valor);
    expect(data!.prefixo).toBe(valor.slice(0, 8));
    const { data: ev } = await db().from("rs_eventos").select("dados").eq("empresa_id", empresa.id).eq("tipo", "credencial_criada").single();
    expect(JSON.stringify(ev!.dados)).not.toContain(valor);
  });
  // Escopo efetivo (11.16): o papel não basta; a conexão precisa do escopo. Achado do verifier do 8.2.
  it("administrador conectado só com leitura não cria chave nem revoga a credencial de outro", async () => {
    const soLeitura = await createTestToken(empresa.id, empresa.adminMembroId, ["leitura"]);
    const r = await callTool(soLeitura, "salvar_conexoes", { operacao: "criar_chave", nome: "escalada", escopos: ["decisao"] });
    expect("structuredContent" in r && r.structuredContent?.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("Esta conexão não tem permissão para isso.");
    const { count } = await db().from("rs_credenciais").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("nome", "escalada");
    expect(count).toBe(0);
    const { data: alheia } = await db().from("rs_credenciais").select("id").eq("empresa_id", empresa.id).eq("prefixo", leitura.slice(0, 8)).single();
    const rv = await callTool(soLeitura, "salvar_conexoes", { operacao: "revogar", credencial: alheia!.id });
    expect("structuredContent" in rv && rv.structuredContent?.ok).toBe(false);
    const { data: ainda } = await db().from("rs_credenciais").select("revogada_em").eq("id", alheia!.id).single();
    expect(ainda!.revogada_em).toBeNull();
  });
  it("conexão sem decisao não cria chave com decisao; revogar a própria conexão só com leitura vale", async () => {
    const semDecisao = await createTestToken(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
    const r = await callTool(semDecisao, "salvar_conexoes", { operacao: "criar_chave", nome: "maior", escopos: ["decisao"] });
    expect("structuredContent" in r && r.structuredContent?.ok).toBe(false);
    const propria = await createTestToken(empresa.id, empresa.adminMembroId, ["leitura"]);
    const { data: c } = await db().from("rs_credenciais").select("id").eq("empresa_id", empresa.id).eq("prefixo", propria.slice(0, 8)).single();
    const rv = await callTool(propria, "salvar_conexoes", { operacao: "revogar", credencial: c!.id });
    expect("structuredContent" in rv && rv.structuredContent?.ok).toBe(true);
  });
  it("o recrutador não cria chave nem vê a opção", async () => {
    const r = await callTool(leitura, "salvar_conexoes", { operacao: "criar_chave", nome: "x", escopos: ["leitura"] });
    expect("content" in r && r.content[0].text).toBe("Seu papel na empresa não permite isso.");
  });
});
