// Link de acompanhamento do candidato (11.4; decisão 1 do 8.6). O token é derivado:
// base64url(HMAC-SHA256(LINK_CANDIDATO_SECRET, "{candidatura}:{versão}")), 32 bytes. No banco fica
// só o SHA-256 dele (token_hash); o servidor recalcula o link sempre que um e-mail precisa dele.
// Girar o link (Perdi o link, duplicada) sobe a versão: o anterior deixa de valer.
import "server-only";
import { createHmac } from "node:crypto";
import { hashToken } from "@/server/auth/tokens";
import { db } from "@/server/db/client";
import { siteOrigin } from "@/server/oauth/server";

function segredo(): string {
  const s = process.env.LINK_CANDIDATO_SECRET ?? "";
  if (s.length < 32) throw new Error("LINK_CANDIDATO_SECRET ausente ou curto (32+ caracteres)");
  return s;
}

// Token da versão de uma candidatura. Recebe: id e versão. Devolve: o token (43 caracteres).
export function tokenDoLink(candidaturaId: string, versao: number): string {
  return createHmac("sha256", segredo()).update(`${candidaturaId}:${versao}`).digest("base64url");
}

// Hash que vai ao banco para a versão.
export function hashDoLink(candidaturaId: string, versao: number): string {
  return hashToken(tokenDoLink(candidaturaId, versao));
}

// URL /c/{token} de um token.
export function urlDoToken(token: string): string {
  return `${siteOrigin()}/c/${token}`;
}

// URL do link vigente (versão atual) de uma candidatura.
export function urlDoLink(candidaturaId: string, versao: number): string {
  return urlDoToken(tokenDoLink(candidaturaId, versao));
}

// Link vigente lido do banco. Se o hash gravado não é o do link derivado (candidatura de antes do
// 8.6, com token aleatório), gira para o derivado: o link antigo deixa de valer e este e-mail leva
// o novo, que funciona. Recebe: empresa e candidatura. Devolve a URL, ou null se a candidatura não
// existe ou foi anonimizada.
export async function linkVigente(empresaId: string, candidaturaId: string): Promise<string | null> {
  const { data, error } = await db().from("rs_candidaturas").select("link_versao, token_hash").eq("empresa_id", empresaId).eq("id", candidaturaId).maybeSingle();
  if (error) throw error;
  if (!data || data.token_hash.startsWith("anonimizada:")) return null;
  if (data.token_hash !== hashDoLink(candidaturaId, data.link_versao)) return giraLink(empresaId, candidaturaId);
  return urlDoLink(candidaturaId, data.link_versao);
}

// Gira o link (sobe a versão e grava o hash novo), com nova tentativa se outra troca chegou antes.
// Recebe: empresa e candidatura. Devolve a URL nova, ou null se não há o que girar.
export async function giraLink(empresaId: string, candidaturaId: string): Promise<string | null> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await db().from("rs_candidaturas").select("link_versao, token_hash").eq("empresa_id", empresaId).eq("id", candidaturaId).maybeSingle();
    if (error) throw error;
    if (!data || data.token_hash.startsWith("anonimizada:")) return null;
    const nova = data.link_versao + 1;
    const { data: ok, error: e2 } = await db().rpc("rs_fn_troca_link", {
      p_candidatura: candidaturaId, p_empresa: empresaId, p_versao: data.link_versao, p_hash: hashDoLink(candidaturaId, nova),
    });
    if (e2) throw e2;
    if (ok) return urlDoLink(candidaturaId, nova);
  }
  throw new Error("link_concorrente");
}
