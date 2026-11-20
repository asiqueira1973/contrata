// Administração da empresa pelas rotas do painel (épico 8.1): matriz da seção 5, guardião relendo o
// vínculo a cada requisição (20.3), criação de empresa (11.33), convites (11.24), último
// administrador (11.26), áreas e pessoas (7.4) e alcance por área (11.32).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { listJobsInScope } from "@/server/org/scope";
import { requireMembro } from "@/server/auth/require-membro";
import { POST as criarEmpresa } from "./empresas/route";
import { GET as slugLivre } from "./empresas/slug/route";
import { POST as convidar } from "./[empresa]/convites/route";
import { POST as reenviar } from "./[empresa]/convites/[id]/reenviar/route";
import { PATCH as mudarAcesso, DELETE as removerMembro } from "./[empresa]/membros/[id]/route";
import { POST as criarArea } from "./[empresa]/areas/route";
import { DELETE as arquivarArea } from "./[empresa]/areas/[id]/route";
import { POST as criarPessoa } from "./[empresa]/pessoas/route";
import { DELETE as arquivarPessoa } from "./[empresa]/pessoas/[id]/route";
import { POST as darAcesso } from "./[empresa]/pessoas/[id]/acesso/route";
import { POST as aceitar } from "../convite/[token]/aceitar/route";
import { POST as sair } from "../../sair/route";
import {
  addMember, apiRequest, captureEmails, cleanup, createArea, createTestCompany, createTestUser, params, trackCompany, type TestUser,
} from "../../../../tests/helpers";

const emails = captureEmails();
let admin: TestUser, recrutador: TestUser, limitado: TestUser, avaliador: TestUser, estranho: TestUser;
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let areaA: string, areaB: string;
const e = () => params({ empresa: empresa.slug });
const base = () => `/api/painel/${empresa.slug}`;

beforeAll(async () => {
  admin = await createTestUser();
  recrutador = await createTestUser();
  limitado = await createTestUser();
  avaliador = await createTestUser();
  estranho = await createTestUser();
  empresa = await createTestCompany(admin);
  areaA = await createArea(empresa, "Loja");
  areaB = await createArea(empresa, "Financeiro");
  await addMember(empresa, recrutador, "recrutador");
  await addMember(empresa, limitado, "recrutador", [areaA]);
  await addMember(empresa, avaliador, "avaliador");
  const outra = await createTestCompany(estranho);
  void outra;
});
afterAll(cleanup);

describe("criar empresa (11.33, 11.20)", () => {
  it("e-mail fora de CRIACAO_EMPRESA_EMAILS é recusado", async () => {
    const res = await criarEmpresa(apiRequest("/api/painel/empresas", { method: "POST", cookie: admin.cookie, body: { nome: "Padaria", slug: `p-${randomUUID().slice(0, 8)}`, email_contato: admin.email } }));
    expect(res.status).toBe(403);
    expect((await res.json()).codigo).toBe("sem_permissao_criar_empresa");
  });
  it("e-mail do domínio liberado cria; slug repetido e reservado dão 'em uso'; formato inválido é recusado", async () => {
    const criador = await createTestUser({ email: `c-${randomUUID().slice(0, 6)}@criador.test` });
    const slug = `p-${randomUUID().slice(0, 8)}`;
    const ok = await criarEmpresa(apiRequest("/api/painel/empresas", { method: "POST", cookie: criador.cookie, body: { nome: "Padaria", slug, email_contato: criador.email } }));
    expect(ok.status).toBe(201);
    trackCompany((await ok.json()).id);
    for (const s of [slug, "painel", "nova"]) {
      const r = await criarEmpresa(apiRequest("/api/painel/empresas", { method: "POST", cookie: criador.cookie, body: { nome: "Outra", slug: s, email_contato: criador.email } }));
      expect(r.status).toBe(409);
      expect((await r.json()).mensagem).toBe("Esse endereço já está em uso. Tente outro.");
    }
    const inv = await criarEmpresa(apiRequest("/api/painel/empresas", { method: "POST", cookie: criador.cookie, body: { nome: "Outra", slug: "-Ruim", email_contato: criador.email } }));
    expect(inv.status).toBe(422);
    const livre = await slugLivre(apiRequest(`/api/painel/empresas/slug?valor=${slug}`, { cookie: criador.cookie }));
    expect(await livre.json()).toEqual({ livre: false, codigo: "slug_em_uso" });
  });
  it("sem Origin a escrita é recusada (20.3)", async () => {
    const res = await criarEmpresa(apiRequest("/api/painel/empresas", { method: "POST", cookie: admin.cookie, origin: null, body: {} }));
    expect(res.status).toBe(403);
  });
});

describe("matriz da seção 5", () => {
  it("quem não é membro recebe 404, sem saber se a empresa existe", async () => {
    const res = await criarPessoa(apiRequest(`${base()}/pessoas`, { method: "POST", cookie: estranho.cookie, body: { nome: "X", email: "x@x.dev" } }), e());
    expect(res.status).toBe(404);
  });
  it("avaliador não cadastra pessoa; recrutador cadastra mas não arquiva nem cria área nem convida", async () => {
    const body = { nome: "Dora", email: `dora-${randomUUID().slice(0, 6)}@teste.dev`, cargo: "Gerente", area_id: areaA };
    expect((await criarPessoa(apiRequest(`${base()}/pessoas`, { method: "POST", cookie: avaliador.cookie, body }), e())).status).toBe(403);
    const ok = await criarPessoa(apiRequest(`${base()}/pessoas`, { method: "POST", cookie: recrutador.cookie, body }), e());
    expect(ok.status).toBe(201);
    const { id } = await ok.json();
    expect((await arquivarPessoa(apiRequest(`${base()}/pessoas/${id}`, { method: "DELETE", cookie: recrutador.cookie }), params({ empresa: empresa.slug, id }))).status).toBe(403);
    expect((await criarArea(apiRequest(`${base()}/areas`, { method: "POST", cookie: recrutador.cookie, body: { nome: "RH" } }), e())).status).toBe(403);
    expect((await convidar(apiRequest(`${base()}/convites`, { method: "POST", cookie: recrutador.cookie, body: { email: "z@teste.dev", papel: "avaliador" } }), e())).status).toBe(403);
    expect((await arquivarPessoa(apiRequest(`${base()}/pessoas/${id}`, { method: "DELETE", cookie: admin.cookie }), params({ empresa: empresa.slug, id }))).status).toBe(204);
  });
});

describe("convites (11.24)", () => {
  it("convite por e-mail; aceito só pela conta do mesmo e-mail", async () => {
    const convidado = await createTestUser({ accepted: true });
    emails.length = 0;
    const res = await convidar(apiRequest(`${base()}/convites`, { method: "POST", cookie: admin.cookie, body: { email: convidado.email.toUpperCase(), papel: "avaliador" } }), e());
    expect(res.status).toBe(201);
    expect(emails).toHaveLength(1);
    const token = emails[0].text.match(/\/convite\/([A-Za-z0-9_-]+)/)![1];
    expect(emails[0].subject).toBe(`Convite para a equipe da ${`Empresa ${empresa.slug}`}`);
    const errado = await aceitar(apiRequest(`/api/convite/${token}/aceitar`, { method: "POST", cookie: estranho.cookie }), params({ token }));
    expect((await errado.json()).codigo).toBe("convite_outro_email");
    const certo = await aceitar(apiRequest(`/api/convite/${token}/aceitar`, { method: "POST", cookie: convidado.cookie }), params({ token }));
    expect(await certo.json()).toEqual({ empresa: empresa.slug });
  });
  it("reenviar gera token novo e invalida o anterior", async () => {
    const convidado = await createTestUser();
    emails.length = 0;
    const res = await convidar(apiRequest(`${base()}/convites`, { method: "POST", cookie: admin.cookie, body: { email: convidado.email, papel: "recrutador", todas_areas: false, areas: [areaB] } }), e());
    const { id } = await res.json();
    const antigo = emails[0].text.match(/\/convite\/([A-Za-z0-9_-]+)/)![1];
    expect((await reenviar(apiRequest(`${base()}/convites/${id}/reenviar`, { method: "POST", cookie: admin.cookie }), params({ empresa: empresa.slug, id }))).status).toBe(204);
    expect(emails).toHaveLength(2);
    const r = await aceitar(apiRequest(`/api/convite/${antigo}/aceitar`, { method: "POST", cookie: convidado.cookie }), params({ token: antigo }));
    expect(r.status).toBe(404);
  });
  it("dar acesso a uma pessoa sem acesso vira convite para o e-mail dela", async () => {
    const email = `sem-${randomUUID().slice(0, 6)}@teste.dev`;
    const p = await criarPessoa(apiRequest(`${base()}/pessoas`, { method: "POST", cookie: admin.cookie, body: { nome: "Bruno", email } }), e());
    const { id } = await p.json();
    emails.length = 0;
    const r = await darAcesso(apiRequest(`${base()}/pessoas/${id}/acesso`, { method: "POST", cookie: admin.cookie, body: { papel: "avaliador" } }), params({ empresa: empresa.slug, id }));
    expect(r.status).toBe(201);
    expect(emails[0].to).toBe(email);
  });
});

describe("vínculo relido a cada requisição (20.3) e último administrador (11.26)", () => {
  it("papel rebaixado vale na requisição seguinte; membro removido perde o acesso", async () => {
    const u = await createTestUser();
    const membroId = await addMember(empresa, u, "administrador");
    const body = { nome: "Área do teste", responsavel_pessoa_id: null };
    expect((await criarArea(apiRequest(`${base()}/areas`, { method: "POST", cookie: u.cookie, body }), e())).status).toBe(201);
    expect((await mudarAcesso(apiRequest(`${base()}/membros/${membroId}`, { method: "PATCH", cookie: admin.cookie, body: { papel: "avaliador" } }), params({ empresa: empresa.slug, id: membroId }))).status).toBe(204);
    expect((await criarArea(apiRequest(`${base()}/areas`, { method: "POST", cookie: u.cookie, body: { nome: "Outra área" } }), e())).status).toBe(403);
    expect((await removerMembro(apiRequest(`${base()}/membros/${membroId}`, { method: "DELETE", cookie: admin.cookie }), params({ empresa: empresa.slug, id: membroId }))).status).toBe(204);
    expect((await criarPessoa(apiRequest(`${base()}/pessoas`, { method: "POST", cookie: u.cookie, body: { nome: "X", email: "x@teste.dev" } }), e())).status).toBe(404);
  });
  it("o último administrador não sai nem é rebaixado, com a copy da 15.2", async () => {
    const r = await mudarAcesso(apiRequest(`${base()}/membros/${empresa.adminMembroId}`, { method: "PATCH", cookie: admin.cookie, body: { papel: "recrutador" } }), params({ empresa: empresa.slug, id: empresa.adminMembroId }));
    expect(r.status).toBe(422);
    expect((await r.json()).mensagem).toBe("A empresa precisa de pelo menos um administrador. Promova outra pessoa antes.");
    const d = await removerMembro(apiRequest(`${base()}/membros/${empresa.adminMembroId}`, { method: "DELETE", cookie: admin.cookie }), params({ empresa: empresa.slug, id: empresa.adminMembroId }));
    expect((await d.json()).codigo).toBe("ultimo_administrador");
  });
  it("mudar o papel revoga os tokens MCP do membro na mesma transação (6.3)", async () => {
    const u = await createTestUser();
    const membroId = await addMember(empresa, u, "recrutador");
    await db().from("rs_credenciais").insert({ empresa_id: empresa.id, tipo: "mcp", nome: "Claude", prefixo: "rsm_test", valor_hash: `h-${randomUUID()}`, escopos: ["leitura"], membro_id: membroId, criada_por_membro_id: membroId });
    await mudarAcesso(apiRequest(`${base()}/membros/${membroId}`, { method: "PATCH", cookie: admin.cookie, body: { papel: "avaliador" } }), params({ empresa: empresa.slug, id: membroId }));
    const { data } = await db().from("rs_credenciais").select("revogada_em").eq("membro_id", membroId);
    expect(data!.every((c) => c.revogada_em)).toBe(true);
  });
  it("membro de outra empresa não é alvo: id de fora dá 404", async () => {
    const { data: outro } = await db().from("rs_membros").select("id").eq("usuario_id", estranho.id).single();
    const r = await removerMembro(apiRequest(`${base()}/membros/${outro!.id}`, { method: "DELETE", cookie: admin.cookie }), params({ empresa: empresa.slug, id: outro!.id }));
    expect(r.status).toBe(404);
  });
});

describe("áreas (7.4) e alcance por área (11.32)", () => {
  it("área única de recrutador limitado não se arquiva", async () => {
    const r = await arquivarArea(apiRequest(`${base()}/areas/${areaA}`, { method: "DELETE", cookie: admin.cookie }), params({ empresa: empresa.slug, id: areaA }));
    expect(r.status).toBe(422);
    expect((await r.json()).mensagem).toBe("Esta área tem vagas abertas ou é a única área de algum recrutador. Mude isso antes de arquivar.");
  });
  it("recrutador limitado à Loja não vê vagas do Financeiro nem as Sem área; avaliador só a equipe", async () => {
    const nova = async (titulo: string, area: string | null) => {
      const { data } = await db().from("rs_vagas").insert({ empresa_id: empresa.id, slug: `v-${randomUUID().slice(0, 8)}`, titulo, modelo_trabalho: "remoto", area_id: area }).select("id").single();
      return data!.id;
    };
    const vLoja = await nova("Vaga da Loja", areaA);
    await nova("Vaga do Financeiro", areaB);
    const vSem = await nova("Vaga sem área", null);
    const { data: m } = await db().from("rs_membros").select("id").eq("usuario_id", avaliador.id).eq("empresa_id", empresa.id).single();
    await db().from("rs_vaga_equipe").insert({ vaga_id: vSem, membro_id: m!.id, papel_na_vaga: "avaliador" });
    const ver = async (u: TestUser) => {
      const ctx = await requireMembro(apiRequest(`${base()}/x`, { cookie: u.cookie }), empresa.slug, "avaliador");
      if (ctx instanceof Response) throw new Error(String(ctx.status));
      return (await listJobsInScope(ctx.empresa.id, ctx.alcance)).map((v) => v.titulo).sort();
    };
    expect(await ver(limitado)).toEqual(["Vaga da Loja"]);
    expect(await ver(avaliador)).toEqual(["Vaga sem área"]);
    expect(await ver(recrutador)).toEqual(["Vaga da Loja", "Vaga do Financeiro", "Vaga sem área"]);
    expect(await ver(admin)).toHaveLength(3);
    void vLoja;
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
