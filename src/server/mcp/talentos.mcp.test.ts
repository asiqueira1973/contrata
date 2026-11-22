// Banco de talentos (épico 8.7): buscar_talentos só entre consentidos válidos e no alcance (o
// avaliador nem vê a ferramenta), convidar_para_vaga manda o e-mail com o link e ?convite= sem criar
// candidatura, quem já é candidato é pulado, candidatar-se pelo link vira banco_talentos, o titular
// entra, renova e sai pelo /c, a faxina avisa 30 dias antes (uma vez) e tira quem venceu, e outra
// empresa não enxerga nada (11.27).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { tokenDoLink } from "@/server/messages/link";
import { expiringTalentsDigest } from "@/server/recruiting/talents";
import { POST as candidatarPost } from "@/app/api/publico/[empresa]/vagas/[slug]/candidaturas/route";
import { POST as concluirPost } from "@/app/api/publico/[empresa]/candidaturas/[id]/concluir/route";
import { POST as talentosPost } from "@/app/api/c/[token]/talentos/route";
import {
  SEM_UI, addMember, apiRequest, callTool, captureEmails, cleanup, createArea, createPublishedJob, createReceivedApplication, createTestCompany,
  createTestToken, createTestUser, listTools, params,
} from "../../../tests/helpers";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let outraEmpresa: Awaited<ReturnType<typeof createTestCompany>>;
let vLoja: { id: string; slug: string }, vFin: { id: string; slug: string }, vNova: { id: string; slug: string };
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;
const nomes = (r: Awaited<ReturnType<typeof callTool>>) => (estrutura(r).itens as { nome: string }[]).map((i) => i.nome).sort();
const candidatoDe = async (cand: string) => (await db().from("rs_candidaturas").select("candidato_id").eq("id", cand).single()).data!.candidato_id;
// Marca o banco de talentos de uma candidatura recebida (como a caixa do formulário faria).
const consentir = async (cand: string) => {
  await db().from("rs_candidatos").update({ talentos_consentido_em: new Date().toISOString(), talentos_expira_em: new Date(Date.now() + 300 * 86_400_000).toISOString() })
    .eq("id", await candidatoDe(cand));
};

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  outraEmpresa = await createTestCompany(await createTestUser());
  const loja = await createArea(empresa, "Loja");
  const fin = await createArea(empresa, "Financeiro");
  vLoja = await createPublishedJob(empresa, { area_id: loja, curriculo_obrigatorio: false });
  vFin = await createPublishedJob(empresa, { area_id: fin, curriculo_obrigatorio: false });
  vNova = await createPublishedJob(empresa, { area_id: loja, curriculo_obrigatorio: false });
  await db().from("rs_empresas").update({ pagina_publicada: true }).eq("id", empresa.id);
  tokens.admin = await createTestToken(empresa.id, empresa.adminMembroId);
  tokens.limitado = await createTestToken(empresa.id, await addMember(empresa, await createTestUser(), "recrutador", [loja]));
  tokens.aval = await createTestToken(empresa.id, await addMember(empresa, await createTestUser(), "avaliador"), ["leitura"]);
  tokens.outra = await createTestToken(outraEmpresa.id, outraEmpresa.adminMembroId);
  ids.bia = await createReceivedApplication(empresa.id, vLoja.id, { nome: "Bia Santos", email: "bia@talentos.exemplo" });
  ids.caio = await createReceivedApplication(empresa.id, vFin.id, { nome: "Caio Melo", email: "caio@talentos.exemplo" });
  ids.davi = await createReceivedApplication(empresa.id, vLoja.id, { nome: "Davi Reis", email: "davi@talentos.exemplo" });
  await consentir(ids.bia);
  await consentir(ids.caio);
});
afterAll(cleanup);

describe("buscar_talentos (8.7, 11.32)", () => {
  it("só quem consentiu; recrutador limitado só a área dele; avaliador e outra empresa não", async () => {
    expect(nomes(await callTool(tokens.admin, "buscar_talentos"))).toEqual(["Bia Santos", "Caio Melo"]);
    expect(nomes(await callTool(tokens.limitado, "buscar_talentos"))).toEqual(["Bia Santos"]);
    expect((await listTools(tokens.aval)).map((t) => t.name)).not.toContain("buscar_talentos");
    expect(nomes(await callTool(tokens.outra, "buscar_talentos"))).toEqual([]);
  });
  it("traz as candidaturas anteriores e nada de e-mail ou telefone", async () => {
    const r = estrutura(await callTool(tokens.admin, "buscar_talentos", { texto: "caio" }));
    const t = (r.itens as { candidaturas: { id: string }[] }[])[0];
    expect(t.candidaturas.map((c) => c.id)).toEqual([ids.caio]);
    expect(JSON.stringify(r)).not.toContain("caio@talentos.exemplo");
  });
});

describe("convidar_para_vaga (8.7)", () => {
  it("manda o e-mail com o link da vaga e ?convite=, sem criar candidatura; quem já é candidato é pulado", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_convidar_para_vaga", {
      candidatos: [await candidatoDe(ids.bia), await candidatoDe(ids.caio)], vaga: vLoja.id,
      assunto: "Uma vaga para você", corpo: "Olá, {{nome}}. Abrimos a vaga de {{vaga}}: {{link_vaga}}",
    }));
    expect(r.ok).toBe(true);
    expect(String(r.resumo)).toBe("1 pessoa convidada. 1 já tinha se candidatado a esta vaga.");
    const e = emails.filter((x) => x.to === "caio@talentos.exemplo").at(-1)!;
    expect(e.text).toMatch(new RegExp(`/${empresa.slug}/vagas/${vLoja.slug}/candidatar\\?convite=[0-9a-f-]{36}`));
    expect(e.text).toContain("banco de talentos");
    const { count } = await db().from("rs_candidaturas").select("id", { count: "exact", head: true }).eq("vaga_id", vLoja.id).eq("candidato_id", await candidatoDe(ids.caio));
    expect(count).toBe(0);
  });
  it("sem consentimento não é convidado; fallback existe", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_convidar_para_vaga", { candidatos: [await candidatoDe(ids.davi)], vaga: vNova.id, assunto: "Oi", corpo: "Olá, {{nome}}." }));
    expect(r.ok).toBe(false);
    expect((await listTools(tokens.admin, SEM_UI)).map((t) => t.name)).toContain("registrar_convidar_para_vaga");
  });
  it("lote com alguém que saiu do banco: convida os outros e diz quantos ficaram de fora (achado do verifier)", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_convidar_para_vaga", {
      candidatos: [await candidatoDe(ids.davi), await candidatoDe(ids.bia)], vaga: vNova.id, assunto: "Oi", corpo: "Olá, {{nome}}. {{link_vaga}}",
    }));
    expect(r.ok).toBe(true);
    expect(String(r.resumo)).toBe("1 pessoa convidada. 1 não está mais no banco de talentos.");
  });
  it("candidatar-se pelo link do convite vira origem banco_talentos", async () => {
    const convite = emails.filter((x) => x.to === "caio@talentos.exemplo").at(-1)!.text.match(/convite=([0-9a-f-]{36})/)![1];
    const req = apiRequest(`/api/publico/${empresa.slug}/vagas/${vLoja.slug}/candidaturas`, { method: "POST", body: {
      nome: "Caio Melo", email: "caio@talentos.exemplo", aceite_privacidade: true, convite,
    } });
    req.headers.set("x-forwarded-for", "10.7.0.1");
    const b = await (await candidatarPost(req, params({ empresa: empresa.slug, slug: vLoja.slug }))).json();
    await concluirPost(apiRequest(`/x`, { method: "POST", body: { concluir_token: b.concluir_token } }), params({ empresa: empresa.slug, id: b.id }));
    const { data } = await db().from("rs_candidaturas").select("origem").eq("id", b.id).single();
    expect(data!.origem).toBe("banco_talentos");
  });
});

describe("/c e faxina (8.7, 11.12)", () => {
  it("o titular entra, renova e sai pelo /c (com Origin)", async () => {
    const token = tokenDoLink(ids.davi, 0);
    expect((await talentosPost(apiRequest(`/api/c/${token}/talentos`, { method: "POST", body: { acao: "entrar" }, origin: null }), params({ token }))).status).toBe(403);
    const entrar = await (await talentosPost(apiRequest(`/api/c/${token}/talentos`, { method: "POST", body: { acao: "entrar" } }), params({ token }))).json();
    expect(entrar.mensagem).toMatch(/^Pronto\. Você está no banco de talentos até/);
    expect(nomes(await callTool(tokens.admin, "buscar_talentos"))).toContain("Davi Reis");
    const sair = await (await talentosPost(apiRequest(`/api/c/${token}/talentos`, { method: "POST", body: { acao: "sair" } }), params({ token }))).json();
    expect(sair.mensagem).toBe("Pronto. Seus dados saíram do banco de talentos.");
    expect(nomes(await callTool(tokens.admin, "buscar_talentos"))).not.toContain("Davi Reis");
  });
  it("aviso 30 dias antes, uma vez, com o link para renovar; vencido sai do banco", async () => {
    await db().from("rs_candidatos").update({ talentos_expira_em: new Date(Date.now() + 10 * 86_400_000).toISOString() }).eq("id", await candidatoDe(ids.bia));
    const antes = emails.length;
    await expiringTalentsDigest(200);
    const aviso = emails.slice(antes).find((e) => e.to === "bia@talentos.exemplo")!;
    expect(aviso.subject).toBe(`Seus dados no banco de talentos da ${(await db().from("rs_empresas").select("nome").eq("id", empresa.id).single()).data!.nome}`);
    expect(aviso.text).toMatch(/Renovar: http:\/\/localhost:3050\/c\/[A-Za-z0-9_-]{43}/);
    const n = emails.length;
    await expiringTalentsDigest(200);
    expect(emails.slice(n).some((e) => e.to === "bia@talentos.exemplo")).toBe(false);
    await db().from("rs_candidatos").update({ talentos_expira_em: new Date(Date.now() - 60_000).toISOString() }).eq("id", await candidatoDe(ids.bia));
    await expiringTalentsDigest(200);
    const { data } = await db().from("rs_candidatos").select("talentos_consentido_em").eq("id", await candidatoDe(ids.bia)).single();
    expect(data!.talentos_consentido_em).toBeNull();
  });
});
