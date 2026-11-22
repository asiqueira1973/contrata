// Webhooks e trilha (épico 8.8; 11.17, 11.18, 13.4, 15.3): formulário só do administrador com o
// segredo só no structuredContent; endereço privado, http, localhost e com credencial recusados;
// criar e trocar o endereço sem formulário recusados (decisão 5); ponta a ponta pelo /mcp com a
// assinatura X-Contrata-Assinatura conferida sobre o corpo cru e sem nome ou e-mail; 500 → falhou →
// retentativa na hora dela entrega; enviar teste; histórico com os cinco atores; GET /eventos.
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as eventosGet } from "@/app/api/v1/eventos/route";
import { POST as notaPost } from "@/app/api/v1/candidaturas/[id]/notas/route";
import { db } from "@/server/db/client";
import { setRemoteFetchTestMode } from "@/server/files/fetch-remote";
import { deliverDue, retryWebhooks } from "@/server/webhooks/deliver";
import {
  SEM_UI, addMember, apiRequest, callTool, cleanup, createArea, createPublishedJob, createReceivedApplication, createTestApiKey, createTestCompany,
  createTestToken, createTestUser, listTools, params,
} from "../../../tests/helpers";
import { startHttps, type Received } from "../../../tests/https-server";

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let outra: Awaited<ReturnType<typeof createTestCompany>>;
let servidor: Awaited<ReturnType<typeof startHttps>>;
let resposta = 200;
let segredo = "";
let webhookId = "";
let vaga: { id: string; slug: string };
let vagaFin: { id: string; slug: string };
const tokens: Record<string, string> = {};
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;
const texto = (r: Awaited<ReturnType<typeof callTool>>) => ("content" in r ? r.content.map((c) => c.text).join(" ") : "");
const erro = (r: Awaited<ReturnType<typeof callTool>>) => JSON.stringify(r);

// Espera chegar um POST do tipo dado (a entrega roda depois da resposta).
async function chegou(tipo: string, desde = 0): Promise<Received> {
  for (let i = 0; i < 50; i++) {
    const r = servidor.received.slice(desde).find((x) => x.headers["x-contrata-evento"] === tipo);
    if (r) return r;
    await deliverDue(empresa.id);
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error(`não chegou ${tipo}`);
}

beforeAll(async () => {
  setRemoteFetchTestMode(true);
  servidor = await startHttps((_req, res) => {
    res.statusCode = resposta;
    res.end("ok");
  });
  empresa = await createTestCompany(await createTestUser());
  outra = await createTestCompany(await createTestUser());
  const loja = await createArea(empresa, "Loja");
  const fin = await createArea(empresa, "Financeiro");
  vaga = await createPublishedJob(empresa, { area_id: loja, curriculo_obrigatorio: false });
  vagaFin = await createPublishedJob(empresa, { area_id: fin, curriculo_obrigatorio: false });
  tokens.admin = await createTestToken(empresa.id, empresa.adminMembroId);
  tokens.recrutador = await createTestToken(empresa.id, await addMember(empresa, await createTestUser(), "recrutador", [loja]));
  tokens.outra = await createTestToken(outra.id, outra.adminMembroId);
});
afterAll(async () => {
  setRemoteFetchTestMode(false);
  await servidor.close();
  await cleanup();
});

describe("formulário webhooks (8.8; 11.17, 11.18)", () => {
  it("só administrador; criar devolve o segredo só no structuredContent", async () => {
    expect((await listTools(tokens.recrutador)).map((t) => t.name)).not.toContain("abrir_formulario_webhooks");
    const r = await callTool(tokens.admin, "salvar_webhooks", {
      operacao: "criar", url: `${servidor.base}/ganchos`, eventos: ["candidatura.criada", "candidatura.etapa_alterada", "candidatura.desistiu"], ativo: true,
    });
    const s = estrutura(r);
    expect(s.ok).toBe(true);
    segredo = (s.segredo as { valor: string }).valor;
    webhookId = (s.ids as string[])[0];
    expect(segredo).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(texto(r)).not.toContain(segredo);
    const { data } = await db().from("rs_webhooks").select("segredo_cifrado").eq("id", webhookId).single();
    expect(data!.segredo_cifrado).not.toContain(segredo);
  });
  it("recusa http, IP privado, metadados, localhost e credencial na URL", async () => {
    setRemoteFetchTestMode(false);
    try {
      for (const url of ["http://exemplo.dev/x", "https://10.0.0.1/x", "https://169.254.169.254/latest", "https://localhost/x", "https://127.0.0.1/x", "https://u:p@exemplo.dev/x"]) {
        const s = estrutura(await callTool(tokens.admin, "salvar_webhooks", { operacao: "criar", url, eventos: ["vaga.publicada"] }));
        expect(s.ok, url).toBe(false);
        expect(JSON.stringify(s.erros), url).toContain("url");
      }
    } finally {
      setRemoteFetchTestMode(true);
    }
  });
  it("sem formulário: criar e trocar o endereço recusados; desligar e ligar pode", async () => {
    expect((await listTools(tokens.admin, SEM_UI)).map((t) => t.name)).toContain("registrar_webhooks");
    const criar = await callTool(tokens.admin, "registrar_webhooks", { operacao: "criar", url: "https://exemplo.dev/x", eventos: ["vaga.publicada"] }, SEM_UI);
    expect(erro(criar)).toContain("so_no_formulario");
    const trocar = await callTool(tokens.admin, "registrar_webhooks", { operacao: "editar", webhook: webhookId, url: "https://exemplo.dev/y" }, SEM_UI);
    expect(erro(trocar)).toContain("so_no_formulario");
    const segredoNovo = await callTool(tokens.admin, "registrar_webhooks", { operacao: "gerar_segredo", webhook: webhookId }, SEM_UI);
    expect(erro(segredoNovo)).toContain("so_no_formulario");
    const previa = estrutura(await callTool(tokens.admin, "registrar_webhooks", { operacao: "editar", webhook: webhookId, ativo: true }, SEM_UI));
    expect(previa.token_previa).toBeTruthy();
  });
  it("enviar teste: POST assinado do tipo teste, sem gravar entrega", async () => {
    const antes = servidor.received.length;
    const r = await callTool(tokens.admin, "salvar_webhooks", { operacao: "enviar_teste", webhook: webhookId });
    expect(texto(r)).toMatch(/respondeu 200 \(ok\)/);
    const p = await chegou("teste", antes);
    expect(JSON.parse(p.body).tipo).toBe("teste");
    const { count } = await db().from("rs_entregas_webhook").select("id", { count: "exact", head: true }).eq("webhook_id", webhookId);
    expect(count).toBe(0);
  });
  it("outra empresa não vê nem testa o webhook", async () => {
    const r = estrutura(await callTool(tokens.outra, "salvar_webhooks", { operacao: "enviar_teste", webhook: webhookId }));
    expect(r.ok).toBe(false);
  });
});

describe("entrega (11.17, 13.4)", () => {
  let candidatura = "";
  it("candidatura recebida e mudança de etapa pelo /mcp chegam assinadas, sem nome nem e-mail", async () => {
    const antes = servidor.received.length;
    candidatura = await createReceivedApplication(empresa.id, vaga.id, { nome: "Bia Gancho", email: "bia@gancho.exemplo" });
    const r = await callTool(tokens.admin, "mover_etapa", { candidaturas: [candidatura], etapa: "Entrevista", vaga: vaga.id });
    expect(texto(r)).toBe("1 candidatura movida para Entrevista.");
    const criada = await chegou("candidatura.criada", antes);
    const movida = await chegou("candidatura.etapa_alterada", antes);
    for (const p of [criada, movida]) {
      const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(String(p.headers["x-contrata-assinatura"]))!;
      expect(m).toBeTruthy();
      expect(createHmac("sha256", segredo).update(`${m[1]}.${p.body}`).digest("hex")).toBe(m[2]);
      expect(p.body).not.toMatch(/Bia|gancho\.exemplo/);
      expect(p.headers["x-contrata-entrega"]).toMatch(/^[0-9a-f-]{36}$/);
    }
    const corpo = JSON.parse(movida.body);
    expect(corpo).toMatchObject({ tipo: "candidatura.etapa_alterada", empresa_id: empresa.id, dados: { candidatura: { id: candidatura, etapa: { nome: "Entrevista" } }, vaga: { id: vaga.id } } });
    const { data } = await db().from("rs_entregas_webhook").select("status, tentativas, ultimo_status_http").eq("webhook_id", webhookId).eq("tipo", "candidatura.etapa_alterada").single();
    expect(data).toEqual({ status: "entregue", tentativas: 1, ultimo_status_http: 200 });
  });
  it("500 fica falhou com a próxima em 1 min; na hora dela, a faxina entrega", async () => {
    resposta = 500;
    const outraCand = await createReceivedApplication(empresa.id, vaga.id, { nome: "Caio Gancho", email: "caio@gancho.exemplo" });
    await deliverDue(empresa.id);
    const { data: f } = await db().from("rs_entregas_webhook").select("id, status, tentativas, ultimo_status_http, proxima_tentativa_em")
      .eq("webhook_id", webhookId).eq("tipo", "candidatura.criada").filter("corpo->dados->candidatura->>id", "eq", outraCand).single();
    expect(f).toMatchObject({ status: "falhou", tentativas: 1, ultimo_status_http: 500 });
    expect(new Date(f!.proxima_tentativa_em).getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(await deliverDue(empresa.id)).toBe(0);
    resposta = 200;
    await db().from("rs_entregas_webhook").update({ proxima_tentativa_em: new Date(Date.now() - 1000).toISOString() }).eq("id", f!.id);
    const r = await retryWebhooks(200);
    expect(r.entregues).toBeGreaterThanOrEqual(1);
    const { data: g } = await db().from("rs_entregas_webhook").select("status, tentativas").eq("id", f!.id).single();
    expect(g).toEqual({ status: "entregue", tentativas: 2 });
  });
  it("webhook desligado não recebe; ligado de novo, volta", async () => {
    await callTool(tokens.admin, "salvar_webhooks", { operacao: "editar", webhook: webhookId, ativo: false });
    await createReceivedApplication(empresa.id, vaga.id, { nome: "Davi Gancho", email: "davi@gancho.exemplo" });
    const { count } = await db().from("rs_entregas_webhook").select("id", { count: "exact", head: true }).eq("webhook_id", webhookId).eq("status", "pendente");
    expect(count).toBe(0);
    await callTool(tokens.admin, "salvar_webhooks", { operacao: "editar", webhook: webhookId, ativo: true });
  });
});

describe("trilha (8.8; 15.3)", () => {
  it("histórico com os cinco atores: candidato, formulário, agente, integração e sistema", async () => {
    const c = await createReceivedApplication(empresa.id, vaga.id, { nome: "Eva Trilha", email: "eva@trilha.exemplo" });
    await callTool(tokens.admin, "mover_etapa", { candidaturas: [c], etapa: "Entrevista", vaga: vaga.id });
    const msg = estrutura(await callTool(tokens.admin, "salvar_mensagem", { candidatura: c, assunto: "Entrevista", corpo: "Olá, {{nome}}. Vamos conversar?" }));
    expect(msg.ok).toBe(true);
    const chave = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
    const req = apiRequest(`/api/v1/candidaturas/${c}/notas`, { method: "POST", body: { texto: "Nota da integração" }, origin: null });
    req.headers.set("authorization", `Bearer ${chave}`);
    expect((await notaPost(req, params({ id: c }))).status).toBe(201);
    // Evento do sistema numa candidatura (o expurgo do 8.10 vai gerar este de verdade).
    await db().rpc("rs_fn_registra_evento", { p_empresa: empresa.id, p_vaga: vaga.id, p_candidatura: c, p_tipo: "candidatura_anonimizada",
      p_ator: { tipo: "sistema", origem: "cron" } as never, p_origem: "cron", p_dados: {} as never });
    const h = estrutura(await callTool(tokens.admin, "historico_da_candidatura", { candidatura: c }));
    const por = Object.fromEntries((h.eventos as { tipo: string; por: string }[]).map((e) => [e.tipo, e.por]));
    expect(por.candidatura_criada).toBe("Candidato");
    expect(por.etapa_alterada).toMatch(/^.+ · em nome de .+$/);
    expect(por.mensagem_enviada).toMatch(/^.+ \(formulário\)$/);
    expect(por.nota_adicionada).toMatch(/^Integração · .+$/);
    expect(por.candidatura_anonimizada).toBe("Sistema");
  });
  it("GET /eventos: crescente depois de desde, paginado, só da empresa, com o webhook na trilha sem segredo", async () => {
    const chave = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
    const get = (q: string) => {
      const r = apiRequest(`/api/v1/eventos${q}`, { origin: null });
      r.headers.set("authorization", `Bearer ${chave}`);
      return eventosGet(r);
    };
    const tudo = await (await get("?limite=200")).json();
    const ids = tudo.itens.map((e: { id: number }) => e.id);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
    expect(tudo.itens.some((e: { tipo: string }) => e.tipo === "webhook_criado")).toBe(true);
    expect(JSON.stringify(tudo)).not.toContain(segredo);
    expect(JSON.stringify(tudo)).not.toMatch(/gancho\.exemplo|trilha\.exemplo/);
    const p1 = await (await get("?limite=2")).json();
    expect(p1.itens).toHaveLength(2);
    expect(p1.proximo_desde).toBe(p1.itens[1].id);
    const p2 = await (await get(`?desde=${p1.proximo_desde}&limite=2`)).json();
    expect(p2.itens[0].id).toBe(ids[2]);
    expect((await get("?desde=-1")).status).toBe(400);
    const deOutra = await createTestApiKey(outra.id, outra.adminMembroId, ["leitura"]);
    const r = apiRequest("/api/v1/eventos", { origin: null });
    r.headers.set("authorization", `Bearer ${deOutra}`);
    const o = await (await eventosGet(r)).json();
    expect(o.itens.every((e: { vaga_id: string | null }) => e.vaga_id !== vaga.id && e.vaga_id !== vagaFin.id)).toBe(true);
  });
});
