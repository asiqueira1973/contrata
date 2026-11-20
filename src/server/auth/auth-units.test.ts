// Unidades do login (seção 6.1, regras 11.25 e 11.33): sessão, rota de volta, listas de e-mail,
// tokens e a validação do id_token do Google com chaves locais.
import { describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { canCreateCompany, isEmailBlocked } from "./allowlist";
import { verifyIdToken } from "./google";
import { safeReturnPath } from "./oauth-state";
import { shouldRenew, signSession, verifySession } from "./session";
import { generateToken, hashToken } from "./tokens";

describe("sessão (6.1)", () => {
  it("assina e lê o usuario_id; segredo errado não vale", async () => {
    const token = await signSession("u-1");
    expect((await verifySession(token))?.usuarioId).toBe("u-1");
    expect(await verifySession(token, "x".repeat(40))).toBeNull();
    expect(await verifySession("lixo")).toBeNull();
  });
  it("renova depois de 7 dias", async () => {
    const issued = new Date("2026-11-01T00:00:00Z");
    const s = (await verifySession(await signSession("u-1", issued)))!;
    expect(shouldRenew(s, new Date("2026-11-07T23:00:00Z"))).toBe(false);
    expect(shouldRenew(s, new Date("2026-11-08T01:00:00Z"))).toBe(true);
  });
});

describe("rota de volta do login", () => {
  it("aceita convite e autorização do conector; recusa o resto (não há painel)", () => {
    expect(safeReturnPath("/painel/padaria/equipe")).toBe("/");
    expect(safeReturnPath("/convite/abc_DEF-1")).toBe("/convite/abc_DEF-1");
    expect(safeReturnPath("/oauth/autorizar?x=1")).toBe("/oauth/autorizar?x=1");
    expect(safeReturnPath("https://outro.site/painel")).toBe("/");
    expect(safeReturnPath("//outro.site")).toBe("/");
    expect(safeReturnPath("/convite//outro")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
  });
});

describe("CRIACAO_EMPRESA_EMAILS (11.33)", () => {
  it("vazia: ninguém cria", () => {
    expect(canCreateCompany("ana@empresa.com.br", "")).toBe(false);
    expect(canCreateCompany("ana@empresa.com.br", undefined)).toBe(false);
  });
  it("e-mail exato, sem diferenciar maiúsculas", () => {
    expect(canCreateCompany("Ana@Empresa.com.br", " ana@empresa.com.br , outro@x.com")).toBe(true);
    expect(canCreateCompany("bruno@empresa.com.br", "ana@empresa.com.br")).toBe(false);
  });
  it("@dominio libera o domínio inteiro e só ele", () => {
    expect(canCreateCompany("bruno@empresa.com.br", "@EMPRESA.com.br")).toBe(true);
    expect(canCreateCompany("bruno@outraempresa.com.br", "@empresa.com.br")).toBe(false);
    expect(canCreateCompany("bruno@sub.empresa.com.br", "@empresa.com.br")).toBe(false);
  });
  it("bloqueados usam a mesma lógica", () => {
    expect(isEmailBlocked("x@spam.test", "@spam.test")).toBe(true);
    expect(isEmailBlocked("x@ok.test", "@spam.test")).toBe(false);
  });
});

describe("tokens (20.3)", () => {
  it("32 bytes em base64url; o banco guarda só o SHA-256", () => {
    const { token, hash } = generateToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

describe("id_token do Google (6.1)", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: "RS256", kid: "k1" }] });
  const sign = (claims: Record<string, unknown>) =>
    new SignJWT({ sub: "g-1", email: "Ana@Teste.dev", name: "Ana", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(process.env.GOOGLE_CLIENT_ID!)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

  it("e-mail verificado entra, em minúsculas", async () => {
    const id = await verifyIdToken(await sign({ email_verified: true }), jwks);
    expect(id).toMatchObject({ sub: "g-1", email: "ana@teste.dev", name: "Ana" });
  });
  it("email_verified = false é recusado", async () => {
    await expect(verifyIdToken(await sign({ email_verified: false }), jwks)).rejects.toThrow("email_nao_verificado");
  });
  it("audiência de outro cliente é recusada", async () => {
    const outro = await new SignJWT({ sub: "g-1", email: "a@b.c", email_verified: true })
      .setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer("https://accounts.google.com").setAudience("outro").setExpirationTime("5m").sign(privateKey);
    await expect(verifyIdToken(outro, jwks)).rejects.toThrow();
  });
});
