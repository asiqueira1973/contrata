// Retorno do Google (6.1, 11.24, 11.25): com o Google simulado e o banco local real.
import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { encodeOAuthCookie } from "@/server/auth/oauth-state";
import { verifySession } from "@/server/auth/session";
import { cleanup, createTestCompany, createTestUser, SITE } from "../../../../../../tests/helpers";

// Google simulado por funções comuns controladas por variável (não vi.fn): no Vitest 5.1.1, uma
// rejeição de vi.fn é dada como falha do teste mesmo quando a rota a trata.
let googleResponde: () => Promise<{ sub: string; email: string; name: string; picture: string | null }> = async () => {
  throw new Error("sem_simulacao");
};
vi.mock("@/server/auth/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/google")>()),
  exchangeCode: async () => "id-token",
  verifyIdToken: () => googleResponde(),
}));
const { GET } = await import("./route");

const subs: string[] = [];
function mockGoogle(identity: { sub: string; email: string } | string) {
  googleResponde = async () => {
    // Recusa do Google (e-mail não verificado, token inválido): a validação rejeita com o código.
    if (typeof identity === "string") throw new Error(identity);
    subs.push(identity.sub);
    return { ...identity, name: "Pessoa Teste", picture: null };
  };
}
function callback(volta = "/oauth/autorizar") {
  return new NextRequest(`${SITE}/api/auth/google/callback?code=c&state=s1`, {
    headers: { cookie: `rs_oauth_google=${encodeOAuthCookie({ state: "s1", verifier: "v", volta })}` },
  });
}

afterAll(async () => {
  await cleanup();
  if (subs.length) await db().from("rs_usuarios").delete().in("google_sub", subs);
});

describe("GET /api/auth/google/callback", () => {
  it("state diferente do cookie: volta com erro e não grava nada", async () => {
    const req = new NextRequest(`${SITE}/api/auth/google/callback?code=c&state=outro`, {
      headers: { cookie: `rs_oauth_google=${encodeOAuthCookie({ state: "s1", verifier: "v", volta: "/oauth/autorizar" })}` },
    });
    const res = await GET(req);
    expect(res.headers.get("location")).toContain("/entrar?erro=falha");
  });

  it("e-mail não verificado no Google é recusado (critério 8.1)", async () => {
    mockGoogle("email_nao_verificado");
    const res = await GET(callback());
    expect(res.headers.get("location")).toContain("/entrar?erro=falha");
    expect(res.cookies.get("rs_sessao")).toBeUndefined();
  });

  it("e-mail bloqueado não grava usuário", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub, email: "bloqueado@teste.dev" });
    const res = await GET(callback());
    expect(res.headers.get("location")).toContain("erro=sem_acesso");
    const { count } = await db().from("rs_usuarios").select("id", { count: "exact", head: true }).eq("google_sub", sub);
    expect(count).toBe(0);
  });

  it("cria o usuário, abre a sessão e o segundo login não duplica", async () => {
    const sub = `sub-${randomUUID()}`;
    const email = `novo-${randomUUID().slice(0, 6)}@teste.dev`;
    mockGoogle({ sub, email });
    const res = await GET(callback("/oauth/autorizar?client_id=x"));
    expect(res.headers.get("location")).toBe(`${SITE}/oauth/autorizar?client_id=x`);
    const session = await verifySession(res.cookies.get("rs_sessao")?.value);
    expect(session?.usuarioId).toBeTruthy();
    await GET(callback());
    const { count } = await db().from("rs_usuarios").select("id", { count: "exact", head: true }).eq("google_sub", sub);
    expect(count).toBe(1);
  });

  it("e-mail que já pertence a outro usuário é recusado", async () => {
    const outro = await createTestUser();
    mockGoogle({ sub: `sub-${randomUUID()}`, email: outro.email });
    const res = await GET(callback());
    expect(res.headers.get("location")).toContain("erro=email_em_uso");
  });

  it("aceita no login os convites pendentes do e-mail e volta para a tela de convite aceito em vez do convite usado (11.24)", async () => {
    const dono = await createTestUser();
    const empresa = await createTestCompany(dono);
    const email = `convidado-${randomUUID().slice(0, 6)}@teste.dev`;
    const { error } = await db().rpc("rs_fn_convida_membro", {
      p_empresa: empresa.id, p_email: email, p_papel: "avaliador", p_todas_areas: true, p_areas: [],
      p_token_hash: "h-callback", p_expira_em: new Date(Date.now() + 86400_000).toISOString(), p_max_pendentes: 50,
      p_ator: { tipo: "membro", membro_id: empresa.adminMembroId },
    });
    expect(error).toBeNull();
    mockGoogle({ sub: `sub-${randomUUID()}`, email });
    const res = await GET(callback("/convite/token-que-nao-existe-mais"));
    expect(res.headers.get("location")).toBe(`${SITE}/convite/aceito`);
    const { data } = await db().from("rs_membros").select("usuario_id, aceito_em").eq("empresa_id", empresa.id).eq("email", email).single();
    expect(data?.aceito_em).toBeTruthy();
  });

  it("usuário suspenso não entra", async () => {
    const u = await createTestUser();
    await db().from("rs_usuarios").update({ suspenso_em: new Date().toISOString() }).eq("id", u.id);
    const { data } = await db().from("rs_usuarios").select("google_sub").eq("id", u.id).single();
    mockGoogle({ sub: data!.google_sub, email: u.email });
    const res = await GET(callback());
    expect(res.headers.get("location")).toContain("erro=suspenso");
  });
});
