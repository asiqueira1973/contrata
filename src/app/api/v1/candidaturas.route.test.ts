// API v1 de candidaturas (8.4; 13.2): escopo escrita, origem integracao, mesmo schema da 11.2,
// upload e conclusão com o concluir_token, duplicada (11.3), vaga de outra empresa (404) e o
// documento OpenAPI válido com as rotas novas.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { db } from "@/server/db/client";
import { POST as criar } from "./candidaturas/route";
import { POST as concluir } from "./candidaturas/[id]/concluir/route";
import { GET as openapiGet } from "./openapi.json/route";
import { apiRequest, captureEmails, cleanup, createPublishedJob, createTestApiKey, createTestCompany, createTestUser, params, uploadTo } from "../../../../tests/helpers";
import { pdf } from "../../../../tests/fixtures/curriculos";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let outra: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string }, vagaDeOutra: { id: string; slug: string };
let leitura: string, escrita: string;

const req = (path: string, tok: string, body?: unknown) => {
  const r = apiRequest(path, { method: "POST", body, origin: null });
  r.headers.set("authorization", `Bearer ${tok}`);
  return r;
};
const corpo = (email: string, extra: Record<string, unknown> = {}) => ({
  vaga_id: vaga.id, nome: "Caio Prado", email, aceite_privacidade: true,
  curriculo: { nome: "cv.pdf", tipo: "application/pdf", bytes: 1000 }, ...extra,
});

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  outra = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa);
  vagaDeOutra = await createPublishedJob(outra);
  leitura = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
  escrita = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
});
afterAll(cleanup);

describe("API v1 — candidaturas", () => {
  it("leitura não cria (403); escrita cria, sobe e conclui com origem integracao e o e-mail ao candidato", async () => {
    expect((await criar(req("/api/v1/candidaturas", leitura, corpo("caio@teste.exemplo")))).status).toBe(403);
    const r = await criar(req("/api/v1/candidaturas", escrita, corpo("caio@teste.exemplo")));
    expect(r.status).toBe(201);
    const b = await r.json();
    expect(b).not.toHaveProperty("link");
    expect((await uploadTo(b.upload_url, pdf("Caixa e estoque"))).status).toBe(200);
    const c = await concluir(req(`/api/v1/candidaturas/${b.id}/concluir`, escrita, { concluir_token: b.concluir_token }), params({ id: b.id }));
    expect(c.status).toBe(200);
    expect(await c.json()).toEqual({ id: b.id, recebida: true });
    const { data } = await db().from("rs_candidaturas").select("origem, recebida_em").eq("id", b.id).single();
    expect(data!.origem).toBe("integracao");
    expect(data!.recebida_em).toBeTruthy();
    const { data: ev } = await db().from("rs_eventos").select("origem, ator_tipo").eq("candidatura_id", b.id).eq("tipo", "candidatura_criada").single();
    expect(ev).toEqual({ origem: "api", ator_tipo: "api" });
    expect(emails.some((e) => e.to === "caio@teste.exemplo" && /\/c\/[A-Za-z0-9_-]{43}/.test(e.text))).toBe(true);
  });
  it("repetida devolve 200 com duplicada", async () => {
    const r = await criar(req("/api/v1/candidaturas", escrita, corpo("caio@teste.exemplo")));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ duplicada: true });
  });
  it("erros por campo da 11.2 e vaga_id ausente", async () => {
    const r = await criar(req("/api/v1/candidaturas", escrita, corpo("nao-e-email", { nome: "C" })));
    expect(r.status).toBe(400);
    const campos = (await r.json()).campos.map((c: { campo: string }) => c.campo);
    expect(campos).toEqual(expect.arrayContaining(["email", "nome"]));
    const semVaga = await criar(req("/api/v1/candidaturas", escrita, { ...corpo("x@teste.exemplo"), vaga_id: undefined }));
    expect((await semVaga.json()).campos).toEqual([expect.objectContaining({ campo: "vaga_id" })]);
  });
  it("vaga de outra empresa é 404; concluir com token errado é 400", async () => {
    expect((await criar(req("/api/v1/candidaturas", escrita, corpo("d@teste.exemplo", { vaga_id: vagaDeOutra.id })))).status).toBe(404);
    const r = await criar(req("/api/v1/candidaturas", escrita, corpo("e@teste.exemplo")));
    const b = await r.json();
    const c = await concluir(req(`/api/v1/candidaturas/${b.id}/concluir`, escrita, { concluir_token: "x" }), params({ id: b.id }));
    expect(c.status).toBe(400);
  });
  it("OpenAPI válido e com as rotas de candidatura", async () => {
    const doc = await (await openapiGet()).json();
    expect(doc.paths["/candidaturas"].post.operationId).toBe("criarCandidatura");
    expect(doc.paths["/candidaturas/{id}/concluir"]).toBeTruthy();
    const v = await new Validator().validate(doc);
    expect(v.valid).toBe(true);
  });
});
