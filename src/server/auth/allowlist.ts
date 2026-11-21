// Listas de e-mail da instância, lidas das variáveis de ambiente (seção 18).
// - EMAILS_BLOQUEADOS: quem não entra (nem conecta o conector) (moderação de quem hospeda).
// - CRIACAO_EMPRESA_EMAILS: quem pode criar empresa (regra 11.33). Vazia = ninguém cria, para
//   que um deploy público nunca vire cadastro aberto.
// Cada item é um endereço exato ou "@dominio", separados por vírgula, sem diferenciar maiúsculas.
import "server-only";

// Diz se o e-mail casa com algum item da lista. Recebe: e-mail e o texto da variável.
function inList(email: string, raw: string | undefined): boolean {
  const target = email.trim().toLowerCase();
  const at = target.lastIndexOf("@");
  if (at < 1) return false;
  const domain = target.slice(at);
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((item) => (item.startsWith("@") ? item === domain : item === target));
}

// Regra 11.33: pode criar empresa? Recebe: e-mail da conta Google; a lista vem do ambiente.
export function canCreateCompany(email: string, raw = process.env.CRIACAO_EMPRESA_EMAILS): boolean {
  return inList(email, raw);
}

// E-mail bloqueado pela instância? (6.1, proteções do retorno do login)
export function isEmailBlocked(email: string, raw = process.env.EMAILS_BLOQUEADOS): boolean {
  return inList(email, raw);
}
