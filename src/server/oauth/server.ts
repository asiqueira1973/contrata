// Servidor de autorização OAuth 2.1 do MCP — seção 6.4, portado do Assina (6.4 de lá).
// Metadados (RFC 8414 e 9728), registro de cliente público (RFC 7591), código com PKCE S256 e
// troca pelo token rsm_… (credencial "mcp" de um membro numa empresa, com os escopos escolhidos).
// O token vale até ser revogado (formulário de conexões, 8.2); sem expires_in nem refresh token.
// Os endereços vêm sempre de NEXT_PUBLIC_SITE_URL, nunca do Host da requisição.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { OAUTH_CLIENTE_NOME_MAX, OAUTH_CODIGO_SEGUNDOS, OAUTH_REDIRECT_URIS_MAX, OAUTH_REDIRECT_URI_MAX, type Escopo } from "@/lib/limits";
import { hashToken } from "@/server/auth/tokens";
import { generateCredential } from "@/server/credentials/keys";
import { db } from "@/server/db/client";

// Origem pública do site (emissor e recurso).
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3050").replace(/\/+$/, "");
}
export const mcpResource = () => `${siteOrigin()}/mcp`;
export const resourceMetadataUrl = () => `${siteOrigin()}/.well-known/oauth-protected-resource`;

// S256 do PKCE. Recebe: o code_verifier. Devolve: base64url do SHA-256.
export function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// redirect_uri aceitável (6.4): https, ou http só em localhost e 127.0.0.1. Sem fragmento nem credenciais.
export function acceptableRedirectUri(uri: string): boolean {
  if (uri.length > OAUTH_REDIRECT_URI_MAX) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-expose-headers": "www-authenticate, mcp-session-id",
};
export function corsHeaders(): Record<string, string> {
  return CORS;
}

// Resposta JSON do fluxo OAuth (sem cache, com CORS).
export function oauthJson(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
}
// Erro no formato do OAuth 2.1.
export function oauthError(error: string, description: string, status = 400): Response {
  return oauthJson({ error, error_description: description }, status);
}

export type OAuthClient = { id: string; nome: string; redirect_uris: string[] };

// Registra um cliente (RFC 7591). Recebe: nome e redirect_uris já conferidos.
export async function registerClient(nome: string, uris: string[]): Promise<OAuthClient> {
  const { data, error } = await db()
    .from("rs_oauth_clientes")
    .insert({ nome: nome.slice(0, OAUTH_CLIENTE_NOME_MAX), redirect_uris: uris.slice(0, OAUTH_REDIRECT_URIS_MAX) })
    .select("id, nome, redirect_uris")
    .single();
  if (error) throw error;
  return data;
}

// Busca um cliente pelo client_id. Devolve: o cliente ou null.
export async function findClient(clientId: string | null | undefined): Promise<OAuthClient | null> {
  if (!clientId || !/^[0-9a-f-]{36}$/.test(clientId)) return null;
  const { data } = await db().from("rs_oauth_clientes").select("id, nome, redirect_uris").eq("id", clientId).maybeSingle();
  return data;
}

// "Permitir" (6.4): grava o código (só o hash) com empresa, membro e escopos, e devolve o valor
// em claro, que vai só no redirect.
export async function createAuthorizationCode(p: { client: OAuthClient; empresaId: string; membroId: string; escopos: Escopo[]; redirectUri: string; codeChallenge: string }): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const { error } = await db().rpc("rs_fn_cria_codigo_oauth", {
    p_codigo_hash: hashToken(code),
    p_cliente: p.client.id,
    p_empresa: p.empresaId,
    p_membro: p.membroId,
    p_escopos: p.escopos,
    p_redirect_uri: p.redirectUri,
    p_code_challenge: p.codeChallenge,
    p_validade_s: OAUTH_CODIGO_SEGUNDOS,
  });
  if (error) throw error;
  return code;
}

// Troca do código pelo token. Devolve: o token em claro ou null (invalid_grant).
export async function exchangeCode(code: string, clientId: string, redirectUri: string, verifier: string): Promise<string | null> {
  const token = generateCredential("mcp");
  const { data, error } = await db().rpc("rs_fn_troca_codigo_oauth", {
    p_codigo_hash: hashToken(code),
    p_cliente: clientId,
    p_redirect_uri: redirectUri,
    p_challenge_do_verifier: s256(verifier),
    p_token_hash: token.hash,
    p_token_prefixo: token.prefixo,
  });
  if (error) throw error;
  return data ? token.valor : null;
}
