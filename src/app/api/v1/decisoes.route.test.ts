// API v1 das decisões (8.6; 13.2, 11.7, 11.8): reprovar e contratar sempre viram proposta (202)
// com chave de qualquer escopo e nunca executam; devolutiva curta recusada; mensagens seguem
// mensagens_agente (202 proposta ou 201 direto, com a cota diária); GET decisoes e modelos;
// nenhuma rota de confirmar; e o "Pedir revisão" do /c (Origin).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { db } from "@/server/db/client";
import { POST as reprovar } from "./candidaturas/[id]/reprovar/route";
import { POST as contratar } from "./candidaturas/[id]/contratar/route";
import { POST as mensagens } from "./candidaturas/[id]/mensagens/route";
import { GET as listarDecisoes } from "./decisoes/route";
import { GET as verDecisao } from "./decisoes/[id]/route";
import { GET as modelos } from "./modelos-mensagem/route";
import { GET as openapiGet } from "./openapi.json/route";
import { POST as revisao } from "@/app/api/c/[token]/revisao/route";
import { tokenDoLink } from "@/server/messages/link";
import { expireProposals, pendingProposalsDigest } from "@/server/recruiting/decisions";
import {
  apiRequest, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestApiKey, createTestCompany, createTestUser, params,
} from "../../../../tests/helpers";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string };
let decisao: string, escrita: string, leitura: string;
const ids: Record<string, string> = {};
const req = (path: string, tok: string, method = "GET", body?: unknown) => {
  const r = apiRequest(path, { method, body, origin: null });
  r.headers.set("authorization", `Bearer ${tok}`);
  return r;
};
const situacao = async (id: string) => (await db().from("rs_candidaturas").select("situacao").eq("id", id).single()).data!.situacao;

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  decisao = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita", "decisao"]);
  escrita = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
  leitura = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
  ids.ana = await createReceivedApplication(empresa.id, vaga.id, { nome: "Ana Lima", email: "ana@api-dec.exemplo" });
  ids.bia = await createReceivedApplication(empresa.id, vaga.id, { nome: "Bia Souza", email: "bia@api-dec.exemplo" });
});
afterAll(cleanup);

describe("API v1 — decisões viram proposta (11.7)", () => {
  it("sem escopo decisao: 403; com todos os escopos: 202 e nada executa", async () => {
    const corpo = { motivo: "requisitos", devolutiva: "Obrigado pelo interesse; seguimos com outras pessoas.", justificativa: "Sem a experiência pedida." };
    expect((await reprovar(req(`/x`, escrita, "POST", corpo), params({ id: ids.ana }))).status).toBe(403);
    const r = await reprovar(req(`/x`, decisao, "POST", corpo), params({ id: ids.ana }));
    expect(r.status).toBe(202);
    const b = await r.json();
    expect(b.mensagem).toContain("peça ao Claude ou ao ChatGPT");
    expect(await situacao(ids.ana)).toBe("ativa");
    const c = await contratar(req(`/x`, decisao, "POST", {}), params({ id: ids.bia }));
    expect(c.status).toBe(202);
    expect(await situacao(ids.bia)).toBe("ativa");
    const d = await (await verDecisao(req(`/x`, leitura), params({ id: b.decisao_id }))).json();
    expect(d).toMatchObject({ tipo: "reprovar", status: "pendente", invalida: null });
    expect(d.proposta_por).toMatch(/^Integração · /);
  });
  it("devolutiva com menos de 20 caracteres é recusada; proposta repetida dá 409", async () => {
    const curta = await reprovar(req(`/x`, decisao, "POST", { motivo: "requisitos", devolutiva: "Não." }), params({ id: ids.bia }));
    expect(curta.status).toBe(400);
    expect((await curta.json()).campos[0].campo).toBe("devolutiva");
    const repetida = await reprovar(req(`/x`, decisao, "POST", { motivo: "requisitos", devolutiva: "Obrigado pelo interesse; seguimos com outras pessoas." }), params({ id: ids.ana }));
    expect(repetida.status).toBe(409);
  });
  it("GET /decisoes filtra por status", async () => {
    const r = await (await listarDecisoes(req("/api/v1/decisoes?status=pendente", leitura))).json();
    expect(r.itens).toHaveLength(2);
    expect((await listarDecisoes(req("/api/v1/decisoes?status=x", leitura))).status).toBe(400);
  });
});

describe("API v1 — mensagens (11.8)", () => {
  it("confirmar (padrão): 202 com proposta e nenhum e-mail", async () => {
    const antes = emails.length;
    const r = await mensagens(req(`/x`, escrita, "POST", { modelo: "convite_entrevista" }), params({ id: ids.ana }));
    expect(r.status).toBe(202);
    expect(emails.length).toBe(antes);
  });
  it("direto: 201 com o e-mail; variável desconhecida recusada; passou da cota, 429", async () => {
    await db().from("rs_empresas").update({ mensagens_agente: "direto" }).eq("id", empresa.id);
    const ruim = await mensagens(req(`/x`, escrita, "POST", { assunto: "Oi", corpo: "Olá {{apelido}}" }), params({ id: ids.bia }));
    expect(ruim.status).toBe(400);
    const r = await mensagens(req(`/x`, escrita, "POST", { assunto: "Oi, {{nome}}", corpo: "Podemos conversar amanhã às 10h?" }), params({ id: ids.bia }));
    expect(r.status).toBe(201);
    expect(emails.at(-1)!.subject).toBe("Oi, Bia");
    // Cota (200 por dia): simula o dia cheio.
    const { data: m } = await db().from("rs_mensagens").select("*").eq("candidatura_id", ids.bia).eq("tipo", "contato").single();
    const { id: _id, criado_em: _c, notificacao_id, ...resto } = m!;
    void _id; void _c;
    await db().from("rs_mensagens").insert(Array.from({ length: 199 }, () => ({ ...resto, notificacao_id })));
    const cheia = await mensagens(req(`/x`, escrita, "POST", { assunto: "Mais", corpo: "Mais uma mensagem." }), params({ id: ids.bia }));
    expect(cheia.status).toBe(429);
  });
  it("GET /modelos-mensagem traz os padrão", async () => {
    const r = await (await modelos(req("/api/v1/modelos-mensagem", leitura))).json();
    expect(r.itens.map((m: { chave: string }) => m.chave)).toEqual(expect.arrayContaining(["devolutiva_padrao", "convite_entrevista", "contratacao"]));
  });
  it("OpenAPI válido, sem rota de confirmar ou descartar", async () => {
    const doc = await (await openapiGet()).json();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/candidaturas/{id}/reprovar", "/candidaturas/{id}/contratar", "/candidaturas/{id}/mensagens", "/decisoes", "/modelos-mensagem"]));
    expect(Object.keys(doc.paths).some((p) => /confirm|descart|reabr|revis/.test(p))).toBe(false);
    expect((await new Validator().validate(doc)).valid).toBe(true);
  });
});

describe("/c — pedir revisão (11.13)", () => {
  it("sem Origin do site, 403; ativa não pede; reprovada pede uma vez", async () => {
    const token = tokenDoLink(ids.ana, 0);
    const semOrigem = apiRequest(`/api/c/${token}/revisao`, { method: "POST", body: {}, origin: null });
    expect((await revisao(semOrigem, params({ token }))).status).toBe(403);
    const ativa = await revisao(apiRequest(`/api/c/${token}/revisao`, { method: "POST", body: {} }), params({ token }));
    expect(ativa.status).toBe(409);
    await db().rpc("rs_fn_decide", {
      p_empresa: empresa.id, p_tipo: "reprovar", p_candidatura: ids.ana, p_vaga: null as never, p_payload: { motivo: "perfil" } as never,
      p_mensagens: { [ids.ana]: { tipo: "devolutiva", assunto: "Sobre", corpo: "Obrigado pelo interesse; seguimos com outras pessoas.",
        notificacao: { tipo: "mensagem_candidato", destinatario: "ana@api-dec.exemplo", chave: `t:${ids.ana}`, assunto: "a", html: "h", texto: "t" } } } as never,
      p_alcance: { tipo: "todas" } as never, p_ator: { tipo: "membro", membro_id: empresa.adminMembroId, origem: "formulario" } as never,
    });
    const ok = await revisao(apiRequest(`/api/c/${token}/revisao`, { method: "POST", body: { texto: "Tenho a certificação." } }), params({ token }));
    expect(ok.status).toBe(200);
    const de_novo = await revisao(apiRequest(`/api/c/${token}/revisao`, { method: "POST", body: {} }), params({ token }));
    expect(de_novo.status).toBe(409);
  });
});

describe("faxina das propostas (12.3; decisão 9 do 8.6)", () => {
  it("pendente há mais de 24 h manda o resumo à equipe uma vez por dia; vencida vira expirada", async () => {
    await db().from("rs_decisoes").update({ criado_em: new Date(Date.now() - 30 * 3600_000).toISOString() }).eq("empresa_id", empresa.id).eq("status", "pendente");
    const antes = emails.length;
    expect(await pendingProposalsDigest()).toBeGreaterThanOrEqual(1);
    const resumo = emails.slice(antes).find((e) => /propostas? esperam? confirmação/.test(e.subject))!;
    expect(resumo.text).toContain("peça ao Claude: mostre as propostas");
    const n = emails.length;
    await pendingProposalsDigest();
    expect(emails.length).toBe(n);
    await db().from("rs_decisoes").update({ expira_em: new Date(Date.now() - 60_000).toISOString() }).eq("empresa_id", empresa.id).eq("status", "pendente");
    expect(await expireProposals(200)).toBeGreaterThanOrEqual(1);
    const { count } = await db().from("rs_decisoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("status", "pendente");
    expect(count).toBe(0);
  });
});
