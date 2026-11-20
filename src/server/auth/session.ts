// Sessão do membro em cookie — seção 6.1.
// Cookie "rs_sessao" com JWT HS256 assinado com SESSION_SECRET; conteúdo: usuario_id e iat.
// Serve só às páginas de entrada (consentimento do conector e convite); quem opera é o token do
// conector, que relê o vínculo a cada chamada.
// Validade de 30 dias, renovado a cada uso quando tem mais de 7 dias (feito no proxy).
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { SESSAO_DIAS, SESSAO_RENOVAR_DEPOIS_DIAS } from "@/lib/limits";

export const SESSION_COOKIE = "rs_sessao";
export const SESSION_MAX_AGE_S = SESSAO_DIAS * 24 * 60 * 60;
export const SESSION_RENEW_AFTER_S = SESSAO_RENOVAR_DEPOIS_DIAS * 24 * 60 * 60;

export type SessionPayload = { usuarioId: string; issuedAt: number };

// Converte o segredo em chave. Recebe: valor opcional (testes). Devolve: bytes da chave.
function secretKey(raw = process.env.SESSION_SECRET): Uint8Array {
  if (!raw || raw.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mín. 32 caracteres)");
  return new TextEncoder().encode(raw);
}

// Assina a sessão de um usuário. Recebe: id do usuário. Devolve: JWT para o cookie.
export async function signSession(usuarioId: string, now = new Date(), rawSecret?: string): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ usuario_id: usuarioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_S)
    .sign(secretKey(rawSecret));
}

// Confere assinatura e validade. Recebe: JWT do cookie. Devolve: a sessão, ou null se inválida.
export async function verifySession(token: string | undefined, rawSecret?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(rawSecret), { algorithms: ["HS256"] });
    if (typeof payload.usuario_id !== "string" || typeof payload.iat !== "number") return null;
    return { usuarioId: payload.usuario_id, issuedAt: payload.iat };
  } catch {
    return null;
  }
}

// Diz se a sessão já passou de 7 dias e deve ser renovada (seção 6.1).
export function shouldRenew(session: SessionPayload, now = new Date()): boolean {
  return Math.floor(now.getTime() / 1000) - session.issuedAt > SESSION_RENEW_AFTER_S;
}

// Opções do cookie de sessão (seção 6.1): HttpOnly, Secure (fora do localhost), SameSite=Lax.
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  };
}
