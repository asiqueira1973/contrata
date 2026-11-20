// API v1 (8.2; 13.2): só chave de API, escopo, cursor e documento OpenAPI 3.1 válido.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { db } from "@/server/db/client";
import { GET as empresaGet } from "./empresa/route";
import { GET as areasGet } from "./areas/route";
import { GET as pessoasGet } from "./pessoas/route";
import { GET as openapiGet } from "./openapi.json/route";
import { apiRequest, cleanup, createArea, createTestApiKey, createTestCompany, createTestToken, createTestUser } from "../../../../tests/helpers";

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let chave: string;

const get = (path: string, tok: string) => {
  const r = apiRequest(path, {});
  r.headers.set("authorization", `Bearer ${tok}`);
  return r;
};

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  chave = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
  for (const n of ["Loja", "Financeiro", "RH"]) await createArea(empresa, n);
});
afterAll(cleanup);

describe("API v1", () => {
  it("GET /empresa com a chave", async () => {
    const r = await empresaGet(get("/api/v1/empresa", chave));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ empresa: { slug: empresa.slug }, credencial: { escopos: ["leitura"] } });
  });
  it("token do conector não serve na API v1; sem credencial, 401", async () => {
    const tok = await createTestToken(empresa.id, empresa.adminMembroId);
    expect((await empresaGet(get("/api/v1/empresa", tok))).status).toBe(401);
    expect((await empresaGet(apiRequest("/api/v1/empresa"))).status).toBe(401);
  });
  it("chave revogada: 401", async () => {
    const k = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
    await db().from("rs_credenciais").update({ revogada_em: new Date().toISOString() }).eq("prefixo", k.slice(0, 8)).eq("empresa_id", empresa.id);
    expect((await empresaGet(get("/api/v1/empresa", k))).status).toBe(401);
  });
  it("/areas pagina por cursor", async () => {
    const p1 = await (await areasGet(get("/api/v1/areas?limite=2", chave))).json();
    expect(p1.itens).toHaveLength(2);
    expect(p1.proximo_cursor).toBeTruthy();
    const p2 = await (await areasGet(get(`/api/v1/areas?limite=2&cursor=${p1.proximo_cursor}`, chave))).json();
    expect(p2.itens).toHaveLength(1);
    expect(p2.proximo_cursor).toBeNull();
  });
  it("/pessoas traz tem_acesso e nunca o papel", async () => {
    const body = await (await pessoasGet(get("/api/v1/pessoas", chave))).json();
    expect(body.itens[0]).toHaveProperty("tem_acesso", true);
    expect(body.itens[0]).not.toHaveProperty("papel");
  });
  it("o documento OpenAPI 3.1 é válido", async () => {
    const doc = await (await openapiGet()).json();
    const res = await new Validator().validate(doc);
    expect(res.errors ?? []).toEqual([]);
    expect(res.valid).toBe(true);
  });
});
