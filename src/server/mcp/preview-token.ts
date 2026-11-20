// Token da prévia do fallback (13.5), copiado de ~/agenda-psi/mcp-server/src/preview-token.ts.
// "sub" aqui é o id da credencial do conector: a prévia de um token não vale para outro.
import "server-only";
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PREVIA_SEGUNDOS } from "@/lib/limits";

/** Validade do `token_previa` (13.5). */
export const VALIDADE_DA_PREVIA_S = PREVIA_SEGUNDOS;

/**
 * JSON canônico: chaves em ordem alfabética em todos os níveis, para o mesmo dado
 * sempre dar o mesmo texto e, portanto, o mesmo HMAC.
 */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const chaves = Object.keys(valor as Record<string, unknown>).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico((valor as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
}

/** HMAC-SHA256 em hex de `sub + acao + JSON canônico + exp` (13.5). */
function assinar(segredo: string, sub: string, acao: string, dados: unknown, exp: number): string {
  return createHmac('sha256', segredo)
    .update(`${sub}\n${acao}\n${jsonCanonico(dados)}\n${exp}`)
    .digest('hex');
}

/**
 * Emite o `token_previa` da chamada 1 do fallback (13.5), no formato `<exp>.<hmac>`.
 * Amarra a pessoa (`sub`), a ação e os dados JÁ NORMALIZADOS: se qualquer um mudar, o
 * token deixa de valer (9.3, exceção). Recebe o relógio em segundos para o teste.
 */
export function emitirTokenDePrevia(
  segredo: string, sub: string, acao: string, dados: unknown, agora = Math.floor(Date.now() / 1000),
): string {
  const exp = agora + VALIDADE_DA_PREVIA_S;
  return `${exp}.${assinar(segredo, sub, acao, dados, exp)}`;
}

/** Resultado da conferência do token: `ok`, ou o motivo da recusa. */
export type ConferenciaDoToken = 'ok' | 'malformado' | 'vencido' | 'divergente';

/**
 * Confere o token da chamada 2 (13.5): formato, validade e HMAC recalculado sobre os
 * dados normalizados de agora, com comparação em tempo constante. Só `ok` grava. É a
 * barreira de P2 que não depende do modelo. `divergente` quer dizer que os dados (ou a
 * pessoa, ou a ação) não são os da prévia, ou que a assinatura foi adulterada: nos dois
 * casos, a resposta certa é gerar uma prévia nova.
 */
export function conferirTokenDePrevia(
  segredo: string, sub: string, acao: string, dados: unknown, token: unknown, agora = Math.floor(Date.now() / 1000),
): ConferenciaDoToken {
  if (typeof token !== 'string') return 'malformado';
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return 'malformado';
  const exp = Number(m[1]);
  if (exp <= agora) return 'vencido';
  const esperado = Buffer.from(assinar(segredo, sub, acao, dados, exp), 'hex');
  const recebido = Buffer.from(m[2]!, 'hex');
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? 'ok' : 'divergente';
}
