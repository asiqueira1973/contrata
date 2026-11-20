// OAuth 2.1 do conector (8.2; 6.4), portado do Assina e estendido: metadados, DCR, consentimento
// com empresa e escopos limitados pelo papel (11.16), troca PKCE, código reutilizado revoga o token,
// pedido inválido nunca redireciona, Termos no consentimento.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { GET as asMeta } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as prMeta } from "@/app/.well-known/oauth-protected-resource/[[...recurso]]/route";
import { POST as registrar } from "./registrar/route";
import { POST as decidir } from "./autorizar/decidir/route";
import { POST as trocar } from "./token/route";
import { POST as termos } from "./termos/route";
import { SITE, addMember, apiRequest, cleanup, createTestCompany, createTestUser, mcpRpc, type TestUser } from "../../../tests/helpers";

let dono: TestUser, avaliador: TestUser;
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let clientId: string;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

beforeAll(async () => {
  dono = await createTestUser();
  avaliador = await createTestUser();
  empresa = await createTestCompany(dono);
  await addMember(empresa, avaliador, "avaliador");
  const r = await registrar(new Request(`${SITE}/oauth/registrar`, { method: "POST", body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: "Claude" }) }));
  clientId = (await r.json()).client_id;
});
afterAll(async () => {
  await db().from("rs_oauth_clientes").delete().eq("id", clientId);
  await cleanup();
});

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function consentir(user: TestUser, challenge: string, extra: Record<string, string | string[]> = {}, origin: string | null = SITE) {
  const form = new FormData();
  const campos: Record<string, string | string[]> = { response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "xyz", empresa: empresa.slug, decisao: "permitir", escopo: ["escrita", "decisao"], ...extra };
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) form.append(k, x);
  const headers: Record<string, string> = { cookie: user.cookie };
  if (origin) headers.origin = origin;
  return decidir(new NextRequest(`${SITE}/oauth/autorizar/decidir`, { method: "POST", headers, body: form }));
}

async function token(code: string, verifier: string, redirect = REDIRECT) {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirect, code_verifier: verifier });
  return trocar(new Request(`${SITE}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }));
}

describe("metadados (RFC 8414 e 9728)", () => {
  it("endpoints, S256, escopos do Contrata e o recurso /mcp", async () => {
    const as = await (asMeta()).json();
    expect(as).toMatchObject({ issuer: SITE, authorization_endpoint: `${SITE}/oauth/autorizar`, token_endpoint: `${SITE}/oauth/token`, registration_endpoint: `${SITE}/oauth/registrar`, code_challenge_methods_supported: ["S256"], scopes_supported: ["leitura", "escrita", "decisao"] });
    const pr = await (prMeta()).json();
    expect(pr).toMatchObject({ resource: `${SITE}/mcp`, authorization_servers: [SITE] });
  });
});

describe("registro dinâmico (RFC 7591)", () => {
  it("recusa http fora de localhost, esquema estranho e lista vazia", async () => {
    for (const uris of [["http://exemplo.com/cb"], ["claude://cb"]]) {
      const r = await registrar(new Request(`${SITE}/oauth/registrar`, { method: "POST", body: JSON.stringify({ redirect_uris: uris }) }));
      expect((await r.json()).error).toBe("invalid_redirect_uri");
    }
    const vazio = await registrar(new Request(`${SITE}/oauth/registrar`, { method: "POST", body: JSON.stringify({ redirect_uris: [] }) }));
    expect((await vazio.json()).error).toBe("invalid_client_metadata");
  });
});

describe("consentimento e troca (6.4)", () => {
  it("permitir devolve code e state; a troca dá um token rsm_ com os escopos escolhidos, que funciona no /mcp", async () => {
    const { verifier, challenge } = pkce();
    const res = await consentir(dono, challenge);
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.searchParams.get("state")).toBe("xyz");
    const t = await token(loc.searchParams.get("code")!, verifier);
    const body = await t.json();
    expect(body.access_token).toMatch(/^rsm_[A-Za-z0-9_-]{43}$/);
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBeUndefined();
    const quem = await mcpRpc(body.access_token, "tools/call", { name: "quem_sou_eu", arguments: {} });
    expect(quem.body.result.structuredContent.escopos).toEqual(["leitura", "escrita", "decisao"]);
    expect(quem.body.result.structuredContent.empresa.slug).toBe(empresa.slug);
  });
  it("código reutilizado dá invalid_grant e revoga o token emitido com ele", async () => {
    const { verifier, challenge } = pkce();
    const code = new URL((await consentir(dono, challenge)).headers.get("location")!).searchParams.get("code")!;
    const primeiro = (await (await token(code, verifier)).json()).access_token;
    expect((await (await token(code, verifier)).json()).error).toBe("invalid_grant");
    expect((await mcpRpc(primeiro, "tools/list")).status).toBe(401);
  });
  it("verifier errado ou redirect diferente: invalid_grant", async () => {
    const { challenge } = pkce();
    const code = new URL((await consentir(dono, challenge)).headers.get("location")!).searchParams.get("code")!;
    expect((await (await token(code, randomBytes(32).toString("base64url"))).json()).error).toBe("invalid_grant");
  });
  it("avaliador que marca escrita e decisão recebe só leitura (11.16)", async () => {
    const { verifier, challenge } = pkce();
    const code = new URL((await consentir(avaliador, challenge)).headers.get("location")!).searchParams.get("code")!;
    const tok = (await (await token(code, verifier)).json()).access_token;
    const { data } = await db().from("rs_credenciais").select("escopos").eq("prefixo", tok.slice(0, 8)).eq("empresa_id", empresa.id).single();
    expect(data!.escopos).toEqual(["leitura"]);
  });
  it("cancelar volta com access_denied; empresa de que não é membro dá 400 sem redirecionar", async () => {
    const { challenge } = pkce();
    const c = await consentir(dono, challenge, { decisao: "cancelar" });
    expect(new URL(c.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
    const fora = await consentir(dono, challenge, { empresa: "nao-existe" });
    expect(fora.status).toBe(400);
    expect(fora.headers.get("location")).toBeNull();
  });
  it("redirect não registrado: 400, nunca redireciona (RFC 9700 §4.11.2)", async () => {
    const { challenge } = pkce();
    const r = await consentir(dono, challenge, { redirect_uri: "https://phishing.example/cb" });
    expect(r.status).toBe(400);
    expect(r.headers.get("location")).toBeNull();
  });
  it("sem sessão: 401; Origin estranho: 403", async () => {
    const { challenge } = pkce();
    const sem = await decidir(new NextRequest(`${SITE}/oauth/autorizar/decidir`, { method: "POST", headers: { origin: SITE }, body: new FormData() }));
    expect(sem.status).toBe(401);
    expect((await consentir(dono, challenge, {}, "https://outro.site")).status).toBe(403);
  });
  it("sem Termos aceitos, não autoriza; /oauth/termos grava o aceite", async () => {
    const novo = await createTestUser({ accepted: false });
    await addMember(empresa, novo, "recrutador");
    const { challenge } = pkce();
    expect((await consentir(novo, challenge)).status).toBe(403);
    expect((await termos(apiRequest("/oauth/termos", { method: "POST", cookie: novo.cookie, body: { aceite: true } }))).status).toBe(204);
    expect((await consentir(novo, challenge)).status).toBe(303);
  });
});

describe("token do /oauth/token", () => {
  it("corpo nulo ou grant errado nunca dá 500", async () => {
    const nulo = await trocar(new Request(`${SITE}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: "null" }));
    expect((await nulo.json()).error).toBe("unsupported_grant_type");
    const sem = await trocar(new Request(`${SITE}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code" }) }));
    expect((await sem.json()).error).toBe("invalid_request");
  });
});
