// Critério 8.11 e seção 21: catálogo fechado (tipo e execução), sem as variáveis nenhuma chamada,
// ingest fora do ar não quebra nem atrasa a rota, eventos nos fluxos (candidatura pela página, mover
// etapa pelo /mcp, formulário salvo com `editado`) com o distinct_id certo e nenhum dado pessoal,
// amostragem da chamada de API e o padrão da rota.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as candidatarPost } from "@/app/api/publico/[empresa]/vagas/[slug]/candidaturas/route";
import { POST as concluirPost } from "@/app/api/publico/[empresa]/candidaturas/[id]/concluir/route";
import { GET as empresaGet } from "@/app/api/v1/empresa/route";
import {
  apiRequest, callTool, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestApiKey, createTestCompany, createTestToken,
  createTestUser, params,
} from "../../../tests/helpers";
import { apiRoutePattern, eventId, flushAnalytics, sampleApiCall, sendToIngest, setAnalyticsSinkForTests, track, type IngestEvent } from "./client";
import { EVENT_SCHEMAS, EVENT_SCREENS, type EventName } from "./events";

captureEmails();
let events: IngestEvent[] = [];
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let adminEmail = "";
let vaga: { id: string; slug: string };
let token = "";
const byName = (n: EventName) => events.filter((e) => e.nome === n);

beforeAll(async () => {
  const u = await createTestUser();
  adminEmail = u.email;
  empresa = await createTestCompany(u);
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  token = await createTestToken(empresa.id, empresa.adminMembroId);
});
beforeEach(() => {
  events = [];
});
afterEach(() => {
  setAnalyticsSinkForTests(null);
  delete process.env.VISAO_INGEST_URL;
  delete process.env.VISAO_API_KEY;
});
afterAll(cleanup);

describe("catálogo fechado (seção 21)", () => {
  it("os 19 eventos têm tela e esquema; nenhuma chave de propriedade pessoal", () => {
    expect(Object.keys(EVENT_SCHEMAS).sort()).toEqual(Object.keys(EVENT_SCREENS).sort());
    expect(Object.keys(EVENT_SCHEMAS)).toHaveLength(19);
    expect(Object.keys(EVENT_SCHEMAS).every((n) => n.startsWith("contrata_"))).toBe(true);
    const proibido = /titulo|nome|email|e_mail|telefone|texto|mensagem|motivo|^ip$|valor|arquivo|token|codigo$|empresa|^area$|^vaga$/;
    for (const schema of Object.values(EVENT_SCHEMAS)) for (const k of Object.keys(schema.shape)) expect(k).not.toMatch(proibido);
  });
  it("propriedade fora do tipo não compila e é descartada em execução", async () => {
    setAnalyticsSinkForTests((e) => events.push(e));
    // @ts-expect-error — titulo não é propriedade de contrata_vaga_criada.
    track("contrata_vaga_criada", { quem: { email: "a@b.dev" }, propriedades: { origem: "chat", titulo: "Analista" } });
    // @ts-expect-error — e-mail nunca é propriedade.
    track("contrata_revisao_pedida", { quem: { candidatura: "x" }, propriedades: { email: "ana@x.dev" } });
    // @ts-expect-error — origem fora da lista.
    track("contrata_etapa_alterada", { quem: { email: "a@b.dev" }, propriedades: { origem: "whatsapp", lote: 1 } });
    track("contrata_vaga_criada", { quem: { email: "a@b.dev" }, propriedades: { origem: "api" } });
    await flushAnalytics();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ nome: "contrata_vaga_criada", tela: "vagas", distinct_id: "a@b.dev", propriedades: { origem: "api" } });
  });
  it("id estável por evento e registro", () => {
    const a = eventId("contrata_vaga_criada", "v1");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(eventId("contrata_vaga_criada", "v1")).toBe(a);
  });
});

describe("liga e desliga (8.11)", () => {
  it("sem VISAO_INGEST_URL e VISAO_API_KEY, nenhuma chamada e nenhum erro", async () => {
    const original = globalThis.fetch;
    let chamadas = 0;
    globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
      chamadas++;
      return original(...a);
    }) as typeof fetch;
    try {
      track("contrata_empresa_criada", { quem: { email: "a@b.dev" }, propriedades: {} });
      await flushAnalytics();
      expect(await sendToIngest([])).toBe(0);
      expect(chamadas).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });
  it("ingest que recusa, dá 500 ou pendura não quebra nem atrasa a rota", async () => {
    let modo: "500" | "pendura" = "500";
    const recebidos: string[] = [];
    const server: Server = createServer((req, res) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => {
        recebidos.push(b);
        if (modo === "500") {
          res.statusCode = 500;
          res.end();
        }
      });
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
    process.env.VISAO_INGEST_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ingest`;
    process.env.VISAO_API_KEY = "chave-teste";
    try {
      const chave = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
      const req = apiRequest("/api/v1/empresa", { origin: null });
      req.headers.set("authorization", `Bearer ${chave}`);
      expect((await empresaGet(req)).status).toBe(200);
      await flushAnalytics();
      expect(recebidos.length).toBeGreaterThanOrEqual(1);
      modo = "pendura";
      const t0 = Date.now();
      track("contrata_empresa_criada", { quem: { email: "a@b.dev" }, propriedades: {} });
      expect(Date.now() - t0).toBeLessThan(50); // não espera a rede
      await flushAnalytics(); // o timeout de 4 s solta o envio pendurado
    } finally {
      server.closeAllConnections();
      await new Promise<void>((ok) => server.close(() => ok()));
    }
  }, 15_000);
});

describe("eventos nos fluxos (seção 21)", () => {
  it("candidatura pela página: iniciada e enviada com cand_{id}, sem dado pessoal", async () => {
    setAnalyticsSinkForTests((e) => events.push(e));
    const req = apiRequest(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, { method: "POST", body: { nome: "Ana Evento", email: "ana@evento.exemplo", telefone: "11999990000", aceite_privacidade: true } });
    req.headers.set("x-forwarded-for", "10.11.0.1");
    const b = await (await candidatarPost(req, params({ empresa: empresa.slug, slug: vaga.slug }))).json();
    await concluirPost(apiRequest("/x", { method: "POST", body: { concluir_token: b.concluir_token } }), params({ empresa: empresa.slug, id: b.id }));
    await flushAnalytics();
    expect(byName("contrata_candidatura_iniciada")[0]).toMatchObject({ distinct_id: `cand_${b.id}`, tela: "candidatar", id: eventId("contrata_candidatura_iniciada", b.id) });
    expect(byName("contrata_candidatura_enviada")[0]).toMatchObject({ distinct_id: `cand_${b.id}`, propriedades: { origem: "pagina", com_curriculo: false, talentos: false } });
    const wire = JSON.stringify(events);
    for (const s of ["Ana", "ana@evento.exemplo", "11999990000", vaga.slug]) expect(wire).not.toContain(s);
  });
  it("mover etapa pelo /mcp: etapa_alterada com o e-mail do membro; formulário salvo com editado", async () => {
    setAnalyticsSinkForTests((e) => events.push(e));
    const c = await createReceivedApplication(empresa.id, vaga.id, { nome: "Bia Evento", email: "bia@evento.exemplo" });
    await callTool(token, "mover_etapa", { candidaturas: [c], etapa: "Entrevista", vaga: vaga.id });
    await callTool(token, "salvar_area", { operacao: "criar", nome: "Loja Evento", __editado: true });
    await flushAnalytics();
    expect(byName("contrata_etapa_alterada")[0]).toMatchObject({ distinct_id: adminEmail, tela: "funil", propriedades: { origem: "mcp", lote: 1 } });
    expect(byName("contrata_formulario_salvo")[0]).toMatchObject({ distinct_id: adminEmail, propriedades: { acao: "area", fallback: false, editado: true } });
    expect(byName("contrata_area_criada")).toHaveLength(1);
    expect(JSON.stringify(events)).not.toMatch(/Bia|bia@evento|Loja Evento/);
  });
});

describe("chamada de API (seção 21)", () => {
  it("amostrada 1 a cada 10 s por credencial; rota sem id", () => {
    expect(sampleApiCall("k1", 1000)).toBe(true);
    expect(sampleApiCall("k1", 5000)).toBe(false);
    expect(sampleApiCall("k2", 5000)).toBe(true);
    expect(sampleApiCall("k1", 12_000)).toBe(true);
    expect(apiRoutePattern("/api/v1/candidaturas/0b5c8a2e-1111-4222-8333-944455556666/mover")).toBe("/api/v1/candidaturas/{id}/mover");
    expect(apiRoutePattern("/api/v1/vagas/abc/resumo")).toBe("/api/v1/vagas/{id}/resumo");
  });
});
