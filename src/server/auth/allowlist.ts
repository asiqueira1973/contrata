// Listas de e-mail da instância, lidas das variáveis de ambiente (seção 18).
// - EMAILS_BLOQUEADOS: quem não entra (nem conecta o conector) (moderação de quem hospeda).
// - CRIACAO_EMPRESA_EMAILS: quem pode criar empresa (regra 11.33). Vazia = ninguém cria, para
//   que um deploy público nunca vire cadastro aberto sem querer; "*" libera qualquer conta Google
//   (instância aberta, como a oficial desde a v0.4.18). O "*" vale só aqui, nunca nos bloqueados.
// Cada item é um endereço exato ou "@dominio", separados por vírgula, sem diferenciar maiúsculas.
import "server-only";
import { EMPRESAS_POR_CONTA_ABERTA } from "@/lib/limits";

// Diz se o e-mail casa com algum item da lista. Recebe: e-mail e o texto da variável.
function inList(email: string, raw: string | undefined, curinga = false): boolean {
  const target = email.trim().toLowerCase();
  const at = target.lastIndexOf("@");
  if (at < 1) return false;
  const domain = target.slice(at);
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((item) => (curinga && item === "*") || (item.startsWith("@") ? item === domain : item === target));
}

// Regra 11.33: pode criar empresa? Recebe: e-mail da conta Google; a lista vem do ambiente.
export function canCreateCompany(email: string, raw = process.env.CRIACAO_EMPRESA_EMAILS): boolean {
  return inList(email, raw, true);
}

// Limite de empresas por conta (v0.4.19): quem está nominalmente na lista (e-mail ou @dominio)
// não tem limite (null); quem só entra pelo "*" cria até EMPRESAS_POR_CONTA_ABERTA.
export function limiteDeEmpresas(email: string, raw = process.env.CRIACAO_EMPRESA_EMAILS): number | null {
  return inList(email, raw) ? null : EMPRESAS_POR_CONTA_ABERTA;
}

// E-mail bloqueado pela instância? (6.1, proteções do retorno do login)
export function isEmailBlocked(email: string, raw = process.env.EMAILS_BLOQUEADOS): boolean {
  return inList(email, raw);
}
