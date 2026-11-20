// Login de membros com Google — seções 4 e 6.1 (o único jeito de entrar, regra 11.25).
// Só escopos básicos (openid email profile): não sensíveis, sem verificação do Google, sem
// refresh token (o Contrata não chama nenhuma API do Google depois do login). PKCE S256 além do
// state. Monta a URL de consentimento, troca o código e valida o id_token.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const LOGIN_SCOPES = ["openid", "email", "profile"] as const;

// Endereço de retorno registrado no Google Cloud (README).
export function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`;
}

// Lê o Client ID do OAuth. Lança erro se faltar a variável.
function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID ausente");
  return id;
}

// Gera o par PKCE (RFC 7636). Devolve: verifier (fica no cookie) e challenge S256 (vai ao Google).
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

// Monta a URL de consentimento (seção 6.1): escopos básicos, select_account para escolher a conta.
// Recebe: state aleatório e o challenge do PKCE.
export function buildAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: LOGIN_SCOPES.join(" "),
    prompt: "select_account",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

// Troca o código de autorização pelo id_token. Recebe: code do callback e o verifier do PKCE.
// Devolve: id_token. Lança erro se o Google recusar ou demorar mais de 5 s.
export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`google_token_${res.status}`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("google_sem_id_token");
  return body.id_token;
}

export type GoogleIdentity = { sub: string; email: string; name: string; picture: string | null };

let remoteJwks: JWTVerifyGetKey | null = null;

// Valida o id_token (seção 6.1: assinatura, aud, iss, exp e email_verified) e devolve a
// identidade. Recebe: id_token e, nos testes, um conjunto de chaves local. Lança erro se inválido.
export async function verifyIdToken(idToken: string, jwks?: JWTVerifyGetKey): Promise<GoogleIdentity> {
  remoteJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks ?? remoteJwks, {
    audience: clientId(),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("id_token_incompleto");
  if (payload.email_verified !== true) throw new Error("email_nao_verificado");
  const email = payload.email.toLowerCase();
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0];
  const picture = typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture : null;
  return { sub: payload.sub, email, name, picture };
}
