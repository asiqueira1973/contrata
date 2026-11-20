// Valores das credenciais de máquina (6.3, 11.15): "rsk_" (chave de API) ou "rsm_" (token do
// conector) + 32 bytes base64url. O banco guarda só o SHA-256 e os 8 primeiros caracteres.
import "server-only";
import { randomBytes } from "node:crypto";
import { CREDENCIAL_PREFIXO_TAMANHO, PREFIXO_CHAVE_API, PREFIXO_TOKEN_MCP, TOKEN_BYTES } from "@/lib/limits";
import { hashToken } from "@/server/auth/tokens";

// Formato aceito no cabeçalho Authorization.
export const CREDENCIAL_FORMATO = /^(rsk|rsm)_[A-Za-z0-9_-]{43}$/;

// Gera uma credencial nova. Recebe: o tipo. Devolve: o valor em claro (mostrado uma vez), o hash
// e o prefixo para exibição.
export function generateCredential(tipo: "api" | "mcp") {
  const valor = (tipo === "api" ? PREFIXO_CHAVE_API : PREFIXO_TOKEN_MCP) + randomBytes(TOKEN_BYTES).toString("base64url");
  return { valor, hash: hashToken(valor), prefixo: valor.slice(0, CREDENCIAL_PREFIXO_TAMANHO) };
}
