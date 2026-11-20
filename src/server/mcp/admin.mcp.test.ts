// Administração da empresa pelo conector (épico 8.2, que porta para o /mcp os testes de rota do 8.1
// sem perder asserção): matriz da seção 5, vínculo relido a cada chamada (20.3), criação de empresa
// (11.33, no consentimento), convites (11.24), último administrador (11.26), revogação de tokens
// (6.3), áreas e pessoas (7.4), alcance por área (11.32), corpo do e-mail apagado (20.3) e /sair.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { resolveCredential } from "@/server/auth/credential";
import { listJobsInScope } from "@/server/org/scope";
import { POST as criarEmpresa } from "@/app/oauth/empresa/route";
import { GET as slugLivre } from "@/app/oauth/empresa/slug/route";
import { POST as aceitar } from "@/app/api/convite/[token]/aceitar/route";
import { POST as sair } from "@/app/sair/route";
import {
  addMember, apiRequest, callTool, captureEmails, cleanup, createArea, createTestCompany, createTestToken, createTestUser, listTools, params, trackCompany, type TestUser,
} from "../../../tests/helpers";

const emails = captureEmails();
let admin: TestUser, recrutador: TestUser, limitado: TestUser, avaliador: TestUser, estranho: TestUser;
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let outra: Awaited<ReturnType<typeof createTestCompany>>;
let areaA: string, areaB: string;
const tokens: Record<string, string> = {};
const membros: Record<string, string> = {};

// Texto do resultado de uma ferramenta (o que o modelo ou o formulário leem).
const texto = (r: Awaited<ReturnType<typeof callTool>>) => ("content" in r ? r.content.map((c) => c.text).join(" ") : "");
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown> | undefined;

beforeAll(async () => {
  admin = await createTestUser();
  recrutador = await createTestUser();
  limitado = await createTestUser();
  avaliador = await createTestUser();
  estranho = await createTestUser();
  empresa = await createTestCompany(admin);
  outra = await createTestCompany(estranho);
  areaA = await createArea(empresa, "Loja");
  areaB = await createArea(empresa, "Financeiro");
  membros.admin = empresa.adminMembroId;
  membros.recrutador = await addMember(empresa, recrutador, "recrutador");
  membros.limitado = await addMember(empresa, limitado, "recrutador", [areaA]);
  membros.avaliador = await addMember(empresa, avaliador, "avaliador");
  for (const k of ["admin", "recrutador", "limitado"]) tokens[k] = await createTestToken(empresa.id, membros[k]);
  // Avaliador conectou marcando tudo, mas o papel só permite leitura (11.16).
  tokens.avaliador = await createTestToken(empresa.id, membros.avaliador);
  tokens.estranho = await createTestToken(outra.id, outra.adminMembroId);
});
afterAll(cleanup);

describe("criar empresa no consentimento (11.33, 11.20)", () => {
  it("e-mail fora de CRIACAO_EMPRESA_EMAILS é recusado", async () => {
    const res = await criarEmpresa(apiRequest("/oauth/empresa", { method: "POST", cookie: admin.cookie, body: { nome: "Padaria", slug: `p-${randomUUID().slice(0, 8)}`, email_contato: admin.email } }));
    expect(res.status).toBe(403);
    expect((await res.json()).codigo).toBe("sem_permissao_criar_empresa");
  });
  it("e-mail do domínio liberado cria; slug repetido e reservado dão 'em uso'; formato inválido é recusado", async () => {
    const criador = await createTestUser({ email: `c-${randomUUID().slice(0, 6)}@criador.test` });
    const slug = `p-${randomUUID().slice(0, 8)}`;
    const ok = await criarEmpresa(apiRequest("/oauth/empresa", { method: "POST", cookie: criador.cookie, body: { nome: "Padaria", slug, email_contato: criador.email } }));
    expect(ok.status).toBe(201);
    trackCompany((await ok.json()).id);
    for (const s of [slug, "painel", "nova", "convite"]) {
      const r = await criarEmpresa(apiRequest("/oauth/empresa", { method: "POST", cookie: criador.cookie, body: { nome: "Outra", slug: s, email_contato: criador.email } }));
      expect(r.status).toBe(409);
      expect((await r.json()).mensagem).toBe("Esse endereço já está em uso. Tente outro.");
    }
    const inv = await criarEmpresa(apiRequest("/oauth/empresa", { method: "POST", cookie: criador.cookie, body: { nome: "Outra", slug: "-Ruim", email_contato: criador.email } }));
    expect(inv.status).toBe(422);
    const livre = await slugLivre(apiRequest(`/oauth/empresa/slug?valor=${slug}`, { cookie: criador.cookie }));
    expect(await livre.json()).toEqual({ livre: false, codigo: "slug_em_uso" });
  });
  it("sem Origin a escrita é recusada (20.3)", async () => {
    const res = await criarEmpresa(apiRequest("/oauth/empresa", { method: "POST", cookie: admin.cookie, origin: null, body: {} }));
    expect(res.status).toBe(403);
  });
});

describe("matriz da seção 5 pelo conector", () => {
  it("o avaliador só vê consultas e o formulário das próprias conexões", async () => {
    const nomes = (await listTools(tokens.avaliador)).map((t) => t.name);
    expect(nomes).toEqual(expect.arrayContaining(["quem_sou_eu", "listar_equipe", "listar_areas", "listar_pessoas", "abrir_formulario_conexoes"]));
    expect(nomes.some((n) => /convite|acesso|area$|pessoa/.test(n) && n !== "listar_pessoas")).toBe(false);
    // Mesmo chamando o salvar direto (como faria um formulário), o papel é conferido de novo.
    const r = await callTool(tokens.avaliador, "salvar_pessoa", { operacao: "cadastrar", nome: "X", email: "x@teste.dev" });
    expect("rpcError" in r || r.isError).toBeTruthy();
  });
  it("recrutador cadastra pessoa, mas não arquiva, não cria área e não convida; administrador arquiva", async () => {
    const nomes = (await listTools(tokens.recrutador)).map((t) => t.name);
    expect(nomes).toContain("salvar_pessoa");
    expect(nomes).not.toContain("salvar_area");
    expect(nomes).not.toContain("salvar_convite");
    const email = `dora-${randomUUID().slice(0, 6)}@teste.dev`;
    const ok = await callTool(tokens.recrutador, "salvar_pessoa", { operacao: "cadastrar", nome: "Dora", email, cargo: "Gerente", area: areaA });
    expect(estrutura(ok)?.ok).toBe(true);
    const id = (estrutura(ok)!.ids as string[])[0];
    const arq = await callTool(tokens.recrutador, "salvar_pessoa", { operacao: "arquivar", pessoa: id });
    expect(texto(arq)).toBe("Seu papel na empresa não permite isso.");
    const arqAdmin = await callTool(tokens.admin, "salvar_pessoa", { operacao: "arquivar", pessoa: id });
    expect(estrutura(arqAdmin)?.ok).toBe(true);
  });
  it("a origem dos eventos de formulário é 'formulario' e o ator é o membro", async () => {
    const { data } = await db().from("rs_eventos").select("origem, ator_tipo").eq("empresa_id", empresa.id).eq("tipo", "pessoa_arquivada").limit(1).single();
    expect(data).toEqual({ origem: "formulario", ator_tipo: "membro" });
  });
});

describe("convites (11.24)", () => {
  it("convite por e-mail; aceito só pela conta do mesmo e-mail", async () => {
    const convidado = await createTestUser({ accepted: true });
    emails.length = 0;
    const r = await callTool(tokens.admin, "salvar_convite", { email: convidado.email.toUpperCase(), papel: "avaliador" });
    expect(estrutura(r)?.ok).toBe(true);
    expect(emails).toHaveLength(1);
    const token = emails[0].text.match(/\/convite\/([A-Za-z0-9_-]+)/)![1];
    expect(emails[0].subject).toBe(`Convite para a equipe da Empresa ${empresa.slug}`);
    const errado = await aceitar(apiRequest(`/api/convite/${token}/aceitar`, { method: "POST", cookie: estranho.cookie }), params({ token }));
    expect((await errado.json()).codigo).toBe("convite_outro_email");
    const certo = await aceitar(apiRequest(`/api/convite/${token}/aceitar`, { method: "POST", cookie: convidado.cookie }), params({ token }));
    expect(await certo.json()).toEqual({ empresa: empresa.slug });
  });
  it("depois do envio, o corpo do e-mail (com o token em claro) sai do banco (20.3)", async () => {
    const convidado = await createTestUser();
    emails.length = 0;
    const r = await callTool(tokens.admin, "salvar_convite", { email: convidado.email, papel: "avaliador" });
    const id = (estrutura(r)!.ids as string[])[0];
    const token = emails[0].text.match(/\/convite\/([A-Za-z0-9_-]+)/)![1];
    const { data } = await db().from("rs_notificacoes").select("status, html, texto").like("chave_idempotencia", `convite_membro:${id}:%`).single();
    expect(data).toEqual({ status: "enviada", html: "", texto: "" });
    const { count } = await db().from("rs_notificacoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).or(`html.like.%${token}%,texto.like.%${token}%`);
    expect(count).toBe(0);
  });
  it("reenviar gera token novo e invalida o anterior", async () => {
    const convidado = await createTestUser();
    emails.length = 0;
    const r = await callTool(tokens.admin, "salvar_convite", { email: convidado.email, papel: "recrutador", todas: "escolher", areas: [areaB] });
    const id = (estrutura(r)!.ids as string[])[0];
    const antigo = emails[0].text.match(/\/convite\/([A-Za-z0-9_-]+)/)![1];
    const re = await callTool(tokens.admin, "salvar_acesso", { membro: id, operacao: "reenviar" });
    expect(estrutura(re)?.ok).toBe(true);
    expect(emails).toHaveLength(2);
    const v = await aceitar(apiRequest(`/api/convite/${antigo}/aceitar`, { method: "POST", cookie: convidado.cookie }), params({ token: antigo }));
    expect(v.status).toBe(404);
  });
  it("dar acesso a uma pessoa sem acesso vira convite para o e-mail dela", async () => {
    const email = `sem-${randomUUID().slice(0, 6)}@teste.dev`;
    const p = await callTool(tokens.admin, "salvar_pessoa", { operacao: "cadastrar", nome: "Bruno", email });
    const id = (estrutura(p)!.ids as string[])[0];
    emails.length = 0;
    const r = await callTool(tokens.admin, "salvar_pessoa", { operacao: "dar_acesso", pessoa: id, papel: "avaliador" });
    expect(estrutura(r)?.ok).toBe(true);
    expect(emails[0].to).toBe(email);
  });
});

describe("vínculo relido a cada chamada (20.3), último administrador (11.26) e tokens (6.3)", () => {
  it("papel rebaixado vale na chamada seguinte; membro removido perde o acesso", async () => {
    const u = await createTestUser();
    const membroId = await addMember(empresa, u, "administrador");
    const tok = await createTestToken(empresa.id, membroId);
    expect(estrutura(await callTool(tok, "salvar_area", { operacao: "criar", nome: "Área do teste" }))?.ok).toBe(true);
    // Rebaixado no banco: o token sobrevive, mas o papel novo vale na hora.
    await db().from("rs_membros").update({ papel: "avaliador" }).eq("id", membroId);
    expect((await listTools(tok)).map((t) => t.name)).not.toContain("salvar_area");
    const r = await callTool(tok, "salvar_area", { operacao: "criar", nome: "Outra área" });
    expect("rpcError" in r || r.isError).toBeTruthy();
    await db().from("rs_membros").update({ papel: "administrador" }).eq("id", membroId);
    // Removido pelo formulário de acesso: o token é revogado e a próxima chamada dá 401.
    expect(estrutura(await callTool(tokens.admin, "salvar_acesso", { membro: membroId, operacao: "remover" }))?.ok).toBe(true);
    const { mcpRpc } = await import("../../../tests/helpers");
    expect((await mcpRpc(tok, "tools/list")).status).toBe(401);
  });
  it("o último administrador não sai nem é rebaixado, com a copy da 15.2", async () => {
    const r = await callTool(tokens.admin, "salvar_acesso", { membro: empresa.adminMembroId, operacao: "mudar", papel: "recrutador" });
    expect(texto(r)).toBe("A empresa precisa de pelo menos um administrador. Promova outra pessoa antes.");
    const d = await callTool(tokens.admin, "salvar_acesso", { membro: empresa.adminMembroId, operacao: "remover" });
    expect(texto(d)).toBe("A empresa precisa de pelo menos um administrador. Promova outra pessoa antes.");
  });
  it("mudar o papel revoga os tokens do conector do membro na mesma transação (6.3)", async () => {
    const u = await createTestUser();
    const membroId = await addMember(empresa, u, "recrutador");
    await createTestToken(empresa.id, membroId);
    await callTool(tokens.admin, "salvar_acesso", { membro: membroId, operacao: "mudar", papel: "avaliador" });
    const { data } = await db().from("rs_credenciais").select("revogada_em").eq("membro_id", membroId);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((c) => c.revogada_em)).toBe(true);
  });
  it("membro de outra empresa não é alvo: id de fora é recusado", async () => {
    const r = await callTool(tokens.admin, "salvar_acesso", { membro: outra.adminMembroId, operacao: "remover" });
    expect(texto(r)).toBe("Esse membro não existe mais. Recarregue a página.");
    const { data } = await db().from("rs_membros").select("removido_em").eq("id", outra.adminMembroId).single();
    expect(data!.removido_em).toBeNull();
  });
  it("o conector de uma empresa não vê a outra (11.27)", async () => {
    const r = await callTool(tokens.estranho, "listar_areas");
    const nomes = ((estrutura(r)?.areas ?? []) as { nome: string }[]).map((a) => a.nome);
    expect(nomes).not.toContain("Loja");
  });
});

describe("áreas (7.4) e alcance por área (11.32)", () => {
  it("área única de recrutador limitado não se arquiva", async () => {
    const r = await callTool(tokens.admin, "salvar_area", { operacao: "arquivar", area: areaA });
    expect(texto(r)).toBe("Esta área tem vagas abertas ou é a única área de algum recrutador. Mude isso antes de arquivar.");
  });
  it("recrutador limitado à Loja não vê vagas do Financeiro nem as Sem área; avaliador só a equipe", async () => {
    const nova = async (titulo: string, area: string | null) => {
      const { data } = await db().from("rs_vagas").insert({ empresa_id: empresa.id, slug: `v-${randomUUID().slice(0, 8)}`, titulo, modelo_trabalho: "remoto", area_id: area }).select("id").single();
      return data!.id;
    };
    await nova("Vaga da Loja", areaA);
    await nova("Vaga do Financeiro", areaB);
    const vSem = await nova("Vaga sem área", null);
    await db().from("rs_vaga_equipe").insert({ vaga_id: vSem, membro_id: membros.avaliador, papel_na_vaga: "avaliador" });
    const ver = async (tok: string) => {
      const ctx = await resolveCredential(`Bearer ${tok}`);
      return (await listJobsInScope(ctx!.empresa.id, ctx!.alcance)).map((v) => v.titulo).sort();
    };
    expect(await ver(tokens.limitado)).toEqual(["Vaga da Loja"]);
    expect(await ver(tokens.avaliador)).toEqual(["Vaga sem área"]);
    expect(await ver(tokens.recrutador)).toEqual(["Vaga da Loja", "Vaga do Financeiro", "Vaga sem área"]);
    expect(await ver(tokens.admin)).toHaveLength(3);
  });
});

describe("POST /sair (6.1, 20.3)", () => {
  it("sem Origin não encerra a sessão; com Origin apaga o cookie", async () => {
    expect((await sair(apiRequest("/sair", { method: "POST", cookie: admin.cookie, origin: null }))).status).toBe(403);
    const ok = await sair(apiRequest("/sair", { method: "POST", cookie: admin.cookie }));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("set-cookie")).toContain("rs_sessao=;");
  });
});
