// Cookie curto do login com Google (seção 6.1): guarda state, verifier do PKCE e a rota de
// volta, por 10 min, HttpOnly, só nas rotas /api/auth/google.
import "server-only";
import { OAUTH_GOOGLE_MINUTOS } from "@/lib/limits";

export const OAUTH_COOKIE = "rs_oauth_google";
export const OAUTH_COOKIE_PATH = "/api/auth/google";
export const OAUTH_COOKIE_MAX_AGE_S = OAUTH_GOOGLE_MINUTOS * 60;

export type OAuthCookie = { state: string; verifier: string; volta: string };

// Rotas para onde o login pode voltar: o painel, o convite (6.1) e a autorização do MCP (6.4).
// Qualquer outra coisa (inclusive URL de outro site) volta para /painel: impede redirecionamento
// aberto. O "*" entra porque o URLSearchParams não o codifica.
const SAFE_RETURN = /^\/(painel|convite|oauth\/autorizar)(\/[A-Za-z0-9\-._~/]*)?(\?[A-Za-z0-9\-._~%&=+*]*)?$/;

// Saneia a rota de volta. Recebe: valor do ?volta=. Devolve: rota segura.
export function safeReturnPath(raw: string | null | undefined): string {
  return raw && SAFE_RETURN.test(raw) && !raw.includes("//") ? raw : "/painel";
}

// Serializa o cookie. Recebe: state, verifier e volta. Devolve: texto base64url.
export function encodeOAuthCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

// Lê o cookie. Recebe: texto do cookie. Devolve: o conteúdo ou null se ausente ou malformado.
export function decodeOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthCookie>;
    if (typeof v.state !== "string" || typeof v.verifier !== "string" || typeof v.volta !== "string") return null;
    return { state: v.state, verifier: v.verifier, volta: safeReturnPath(v.volta) };
  } catch {
    return null;
  }
}
