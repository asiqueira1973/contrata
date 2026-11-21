// Link de pré-visualização da página de carreiras não publicada (critério do 8.3): assinado com
// HMAC-SHA256 (PREVIA_PAGINA_SECRET, 32+ caracteres), vale 10 min e só para a empresa dele. A
// página mostra a faixa "Página ainda não publicada" e sai com noindex. O token não identifica
// ninguém: leva só o id da empresa e o vencimento.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PREVIA_PAGINA_SEGUNDOS } from "@/lib/limits";

function segredo(): string {
  const s = process.env.PREVIA_PAGINA_SECRET ?? "";
  if (s.length < 32) throw new Error("PREVIA_PAGINA_SECRET ausente ou curto");
  return s;
}

function assinatura(empresaId: string, exp: number): string {
  return createHmac("sha256", segredo()).update(`previa:${empresaId}:${exp}`).digest("base64url");
}

// Gera o token. Recebe: id da empresa e o instante (testes). Devolve: "exp.assinatura".
export function tokenDePrevia(empresaId: string, agora = Date.now()): string {
  const exp = Math.floor(agora / 1000) + PREVIA_PAGINA_SEGUNDOS;
  return `${exp}.${assinatura(empresaId, exp)}`;
}

// Confere o token para a empresa. Devolve: true só se a assinatura bate e não venceu.
export function previaValida(empresaId: string, token: string | null | undefined, agora = Date.now()): boolean {
  if (!token) return false;
  const [expTxt, sig] = token.split(".");
  const exp = Number(expTxt);
  if (!Number.isInteger(exp) || !sig || exp < Math.floor(agora / 1000)) return false;
  const esperado = Buffer.from(assinatura(empresaId, exp));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

// Endereço completo da pré-visualização. Recebe: origem do site, slug e id da empresa.
export function linkDePrevia(site: string, slug: string, empresaId: string): string {
  return `${site}/${slug}?previa=${encodeURIComponent(tokenDePrevia(empresaId))}`;
}
