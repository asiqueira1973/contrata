// Envio dos eventos de produto ao Visão do Produto — critério 8.11 e seção 21 (porte do Assina).
// - Dispara e esquece: track() é síncrona, nunca lança e nunca espera a rede. O trabalho (achar o
//   e-mail do remetente, calcular propriedades, validar e postar) roda depois da resposta (after
//   do Next) ou, fora de uma requisição, numa promessa solta. Timeout de 4 s no POST.
// - Sem VISAO_INGEST_URL ou VISAO_API_KEY, não faz nada (dev e testes).
// - Propriedades passam pelo esquema fechado do catálogo (events.ts): fora dele, o evento é
//   descartado. Log só com o nome do evento ou o código do erro, nunca com o conteúdo.
// - `id`: derivado do registro quando existe (mesmo evento do mesmo registro = mesmo id, e o
//   ingest deduplica); sem registro, aleatório.
// - `distinct_id`: e-mail do membro nos eventos de membro, `cand_{candidatura_id}` nos do candidato
//   (nunca o e-mail), `emp_{empresa_id}` nos de integração (chave de API) e sistema.
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { ANALYTICS_AMOSTRA_API_MS, ANALYTICS_AMOSTRAS_EM_MEMORIA, ANALYTICS_TIMEOUT_MS } from "@/lib/limits";
import { db } from "@/server/db/client";
import { errorCode } from "@/server/error-code";
import { EVENT_SCHEMAS, EVENT_SCREENS, type EventName, type PropriedadesDeEvento } from "./events";

/**
 * Quem fez: o membro ou a credencial do conector (o e-mail é lido depois da resposta), o e-mail já
 * conhecido, a candidatura (o candidato) ou a empresa (integração e sistema).
 */
export type Who = { membro: string } | { credencial: string } | { email: string } | { candidatura: string } | { empresa: string };

export type TrackInput<N extends EventName> = {
  quem: Who;
  /** Id do registro que o evento descreve (vaga, candidatura, decisão…), para deduplicar. */
  chave?: string;
  /** As propriedades, ou uma função que as calcula depois da resposta (null descarta o evento). */
  propriedades: PropriedadesDeEvento[N] | (() => Promise<PropriedadesDeEvento[N] | null>);
};

/** O evento como o ingest recebe (POST {eventos: [...]}). */
export type IngestEvent = {
  id: string;
  nome: EventName;
  distinct_id: string;
  ocorrido_em: string;
  tela: string;
  propriedades: Record<string, unknown>;
};

let sink: ((e: IngestEvent) => void) | null = null;
const pending = new Set<Promise<void>>();

// Só para testes: recebe os eventos prontos em vez de postar. null volta ao normal.
export function setAnalyticsSinkForTests(fn: ((e: IngestEvent) => void) | null): void {
  sink = fn;
}

// Só para testes: espera os envios que rodaram fora de uma requisição (sem after).
export async function flushAnalytics(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}

// Diz se o envio está ligado: só com o endereço do ingest e a chave (em dev e nos testes, não).
function configured(): boolean {
  return !!process.env.VISAO_INGEST_URL && !!process.env.VISAO_API_KEY;
}

// Registra um evento da seção 21. Recebe: o nome e quem/chave/propriedades. Não devolve nada e
// nunca lança: analytics não quebra fluxo (critério 8.11).
export function track<N extends EventName>(nome: N, input: TrackInput<N>): void {
  try {
    if (!sink && !configured()) return;
    const ocorridoEm = new Date().toISOString();
    const task = () => deliver(nome, input, ocorridoEm);
    try {
      after(task);
    } catch {
      // Fora de uma requisição (faxina, testes): promessa solta, sem await.
      const p: Promise<void> = task().finally(() => pending.delete(p));
      pending.add(p);
    }
  } catch (e) {
    console.warn("analytics_falhou", errorCode(e));
  }
}

// Monta, valida e entrega um evento. Nunca lança.
async function deliver<N extends EventName>(nome: N, input: TrackInput<N>, ocorridoEm: string): Promise<void> {
  try {
    const raw = typeof input.propriedades === "function" ? await input.propriedades() : input.propriedades;
    if (raw === null) return;
    const parsed = EVENT_SCHEMAS[nome].safeParse(raw);
    if (!parsed.success) {
      console.warn("analytics_evento_invalido", nome);
      return;
    }
    const distinctId = await resolveWho(input.quem);
    if (!distinctId) return;
    const event: IngestEvent = {
      id: input.chave ? eventId(nome, input.chave) : randomUUID(),
      nome,
      distinct_id: distinctId,
      ocorrido_em: ocorridoEm,
      tela: EVENT_SCREENS[nome],
      propriedades: parsed.data as Record<string, unknown>,
    };
    if (sink) {
      sink(event);
      return;
    }
    await sendToIngest([event]);
  } catch (e) {
    console.warn("analytics_falhou", errorCode(e));
  }
}

// distinct_id (seção 21). Devolve: o identificador, ou null se o membro sumiu.
async function resolveWho(who: Who): Promise<string | null> {
  if ("email" in who) return who.email;
  if ("candidatura" in who) return `cand_${who.candidatura}`;
  if ("empresa" in who) return `emp_${who.empresa}`;
  if ("credencial" in who) {
    const { data } = await db().from("rs_credenciais").select("membro:membro_id(usuario:usuario_id(email))").eq("id", who.credencial).maybeSingle();
    return ((data?.membro as { usuario: { email: string } | null } | null)?.usuario?.email) ?? null;
  }
  const { data } = await db().from("rs_membros").select("usuario:usuario_id(email)").eq("id", who.membro).maybeSingle();
  return (data?.usuario as { email: string } | null)?.email ?? null;
}

// Quem é o ator, para o distinct_id: membro (formulário, agente, web), empresa (chave, sistema)
// ou a candidatura (candidato). Recebe: o ator, a empresa e a candidatura, se houver.
export function quemDoAtor(ator: { tipo: string; membroId?: string }, empresaId: string, candidaturaId?: string): Who {
  if (ator.tipo === "candidato" && candidaturaId) return { candidatura: candidaturaId };
  if (ator.membroId) return { membro: ator.membroId };
  return { empresa: empresaId };
}

// Id estável do evento de um registro: sha256(nome:chave) no formato de UUID (versão 8, RFC 9562).
// O mesmo evento do mesmo registro, mandado duas vezes, é deduplicado pelo ingest.
export function eventId(nome: string, chave: string): string {
  const h = createHash("sha256").update(`${nome}:${chave}`).digest("hex").split("");
  h[12] = "8";
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

// POST no ingest do Visão do Produto, com timeout. Recebe: os eventos. Devolve: o status HTTP,
// ou 0 se não chegou (fora do ar, timeout). Nunca lança; loga só o status ou o código.
export async function sendToIngest(events: IngestEvent[]): Promise<number> {
  const url = process.env.VISAO_INGEST_URL;
  const key = process.env.VISAO_API_KEY;
  if (!url || !key) return 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ eventos: events }),
      signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      console.warn("analytics_falhou", `http_${res.status}`);
      return res.status;
    }
    // 202 com eventos recusados (nome ou campo fora do contrato): loga só quantos.
    const body = (await res.json().catch(() => null)) as { rejeitados?: unknown[] } | null;
    if (body?.rejeitados?.length) console.warn("analytics_rejeitados", body.rejeitados.length);
    return res.status;
  } catch (e) {
    console.warn("analytics_falhou", e instanceof Error && e.name === "TimeoutError" ? "timeout" : errorCode(e));
    return 0;
  }
}

// Amostragem de contrata_api_chamada (seção 21): no máximo 1 a cada 10 s por credencial, por
// instância do servidor. Recebe: a credencial. Devolve: se este pedido entra.
const lastApiSample = new Map<string, number>();
export function sampleApiCall(credentialId: string, now = Date.now()): boolean {
  const last = lastApiSample.get(credentialId);
  if (last !== undefined && now - last < ANALYTICS_AMOSTRA_API_MS) return false;
  if (lastApiSample.size > ANALYTICS_AMOSTRAS_EM_MEMORIA) lastApiSample.clear();
  lastApiSample.set(credentialId, now);
  return true;
}

// contrata_api_chamada (seção 21), amostrado por credencial. Recebe: a credencial, quem, o pathname,
// o status da resposta e a porta.
export function trackApiCall(credentialId: string, quem: Who, pathname: string, status: number, porta: "v1" | "mcp"): void {
  if (!sampleApiCall(credentialId)) return;
  track("contrata_api_chamada", { quem, propriedades: { rota: apiRoutePattern(pathname), status, porta } });
}

// Padrão da rota (seção 21: "rota" sem id). Só os segmentos conhecidos ficam; qualquer outro vira
// {id}. Recebe: o pathname. Devolve: ex. "/api/v1/candidaturas/{id}/mover".
const KNOWN_SEGMENTS = new Set([
  "api", "v1", "mcp", "empresa", "areas", "pessoas", "vagas", "etapas", "perguntas", "equipe", "publicar", "pausar", "encerrar", "resumo",
  "candidaturas", "concluir", "curriculo", "mover", "notas", "reprovar", "contratar", "mensagens", "decisoes", "modelos-mensagem",
  "talentos", "convidar", "eventos", "openapi.json",
]);
export function apiRoutePattern(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean).slice(0, 8);
  return "/" + parts.map((p) => (KNOWN_SEGMENTS.has(p) ? p : "{id}")).join("/");
}
