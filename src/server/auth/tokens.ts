// Tokens do sistema (6.2, 11.4, 11.24, 20.3): 32 bytes aleatórios em base64url; o banco guarda só
// o SHA-256. Como o banco busca pelo hash (índice único), não há comparação de segredo em memória.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { TOKEN_BYTES } from "@/lib/limits";

// SHA-256 em hex de um token. Recebe: o token em claro. Devolve: o hash.
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Gera um token novo. Devolve: o valor em claro (vai só no e-mail) e o hash (vai ao banco).
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashToken(token) };
}
