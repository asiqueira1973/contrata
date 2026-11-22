// API v1 do banco de talentos (8.7; 13.2): leitura lista só quem consentiu; escrita convida (201) ou
// diz que já é candidato (200); pessoa de outra empresa não é convidada; OpenAPI válido.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { db } from "@/server/db/client";
import { GET as listar } from "./talentos/route";
import { POST as convidar } from "./talentos/[id]/convidar/route";
import { GET as openapiGet } from "./openapi.json/route";
import {
  apiRequest, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestApiKey, createTestCompany, createTestUser, params,
} from "../../../../tests/helpers";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>, outra: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string }, nova: { id: string; slug: string };
let leitura: string, escrita: string;
const pessoa: Record<string, string> = {};
const req = (path: string, tok: string, method = "GET", body?: unknown) => {
  const r = apiRequest(path, { method, body, origin: null });
  r.headers.set("authorization", `Bearer ${tok}`);
  return r;
};

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  outra = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  nova = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  const vOutra = await createPublishedJob(outra, { curriculo_obrigatorio: false });
  leitura = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
  escrita = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
  for (const [k, e, v] of [["ana", empresa.id, vaga.id], ["zed", outra.id, vOutra.id]] as const) {
    const c = await createReceivedApplication(e, v, { nome: `Pessoa ${k}`, email: `${k}@api-tal.exemplo` });
    const { data } = await db().from("rs_candidaturas").select("candidato_id").eq("id", c).single();
    pessoa[k] = data!.candidato_id;
    await db().from("rs_candidatos").update({ talentos_consentido_em: new Date().toISOString(), talentos_expira_em: new Date(Date.now() + 90 * 86_400_000).toISOString() }).eq("id", pessoa[k]);
  }
});
afterAll(cleanup);

describe("API v1 — banco de talentos", () => {
  it("GET lista só a empresa da chave", async () => {
    const r = await (await listar(req("/api/v1/talentos", leitura))).json();
    expect(r.itens.map((i: { nome: string }) => i.nome)).toEqual(["Pessoa ana"]);
    expect((await listar(req("/api/v1/talentos?vaga_id=x", leitura))).status).toBe(400);
  });
  it("convidar: leitura 403; escrita 201 e o e-mail sai; já candidata 200; de outra empresa 409", async () => {
    expect((await convidar(req("/x", leitura, "POST", { vaga_id: nova.id }), params({ id: pessoa.ana }))).status).toBe(403);
    const ok = await convidar(req("/x", escrita, "POST", { vaga_id: nova.id }), params({ id: pessoa.ana }));
    expect(ok.status).toBe(201);
    expect(emails.some((e) => e.to === "ana@api-tal.exemplo" && e.text.includes("?convite="))).toBe(true);
    const ja = await convidar(req("/x", escrita, "POST", { vaga_id: vaga.id }), params({ id: pessoa.ana }));
    expect(ja.status).toBe(200);
    expect(await ja.json()).toEqual({ convidado: false, ja_candidato: true });
    expect((await convidar(req("/x", escrita, "POST", { vaga_id: nova.id }), params({ id: pessoa.zed }))).status).toBe(409);
  });
  it("convidar pela API usa o modelo da empresa (sem texto livre) e não reenvia no mesmo dia (achado do verifier)", async () => {
    const antes = emails.filter((e) => e.to === "ana@api-tal.exemplo").length;
    const r = await convidar(req("/x", escrita, "POST", { vaga_id: nova.id, assunto: "Assunto livre", corpo: "corpo livre" }), params({ id: pessoa.ana }));
    expect(r.status).toBe(201);
    const depois = emails.filter((e) => e.to === "ana@api-tal.exemplo");
    expect(depois.length).toBe(antes);
    expect(depois.some((e) => e.subject === "Assunto livre" || e.text.includes("corpo livre"))).toBe(false);
  });
  it("OpenAPI válido com as rotas de talentos", async () => {
    const doc = await (await openapiGet()).json();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/talentos", "/talentos/{id}/convidar"]));
    expect((await new Validator().validate(doc)).valid).toBe(true);
  });
});
