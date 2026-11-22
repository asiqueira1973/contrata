// Cifra simétrica do segredo dos webhooks guardado no banco (regra 11.17; épico 8.8, porte do
// Assina). AES-256-GCM com a chave CHAVES_ENC_KEY (32 bytes em base64); formato "iv.tag.cifra"
// em base64url. A tag do GCM faz qualquer adulteração do texto cifrado falhar na decifra.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Lê e valida a chave. Recebe: valor opcional (testes). Devolve: 32 bytes.
function key(raw = process.env.CHAVES_ENC_KEY): Buffer {
  const k = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new Error("CHAVES_ENC_KEY ausente ou sem 32 bytes (base64)");
  return k;
}

// Cifra um texto. Recebe: texto em claro. Devolve: "iv.tag.cifra" em base64url.
export function encryptSecret(plain: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

// Decifra. Recebe: "iv.tag.cifra". Devolve: texto em claro. Lança erro se o formato ou a tag
// não conferirem (texto adulterado ou chave errada).
export function decryptSecret(sealed: string, rawKey?: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 3) throw new Error("segredo_cifrado_invalido");
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"));
  // Tag de 16 bytes exigida: o GCM aceitaria uma tag truncada, que é mais fácil de forjar.
  if (iv.length !== 12 || tag.length !== 16) throw new Error("segredo_cifrado_invalido");
  const decipher = createDecipheriv("aes-256-gcm", key(rawKey), iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
