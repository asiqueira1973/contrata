// Quem opera esta instância (8.12; seções 20 e 27): nome e contato para o aviso de privacidade
// e para as páginas legais, que são modelos. Recebe nada; devolve `nome` (OPERADOR_NOME ou nulo)
// e `contato` (OPERADOR_CONTATO, senão ADMIN_EMAIL, senão nulo). Regra: o nome de quem hospeda
// nunca é escrito à mão no código; sem a variável, os textos dizem "quem hospeda esta instância".
import "server-only";

export function operador(): { nome: string | null; contato: string | null } {
  const nome = process.env.OPERADOR_NOME?.trim() || null;
  const contato = process.env.OPERADOR_CONTATO?.trim() || process.env.ADMIN_EMAIL?.trim() || null;
  return { nome, contato };
}
