// /mcp (seção 21): só tools/call conta como uso. A conexão sozinha (initialize, tools/list,
// notificações), que todo Claude com o conector faz ao abrir, e o pedido recusado pelo SDK não geram
// vaga_aberta_api_chamada. Pedido recusado deixa um log "mcp_rejeitado" sem dado pessoal.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { captureEmails, cleanup, createTestCompany, createTestToken, createTestUser } from "../../../tests/helpers";
import { flushAnalytics, setAnalyticsSinkForTests, type IngestEvent } from "@/server/analytics/client";

captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let email = "";
let events: IngestEvent[] = [];
let id = 0;

// POST cru no /mcp, com o método JSON-RPC (id só se não for notificação) e a versão do protocolo.
async function rpc(token: string, method: string, versao = "2025-06-18", params: Record<string, unknown> = {}, extra: Record<string, string> = {}) {
  const { POST } = await import("@/app/mcp/route");
  const notificacao = method.startsWith("notifications/");
  const req = new NextRequest("http://localhost:3050/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": versao,
      "user-agent": "Claude-User/1.0 (teste)",
      ...extra,
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...(notificacao ? {} : { id: ++id }), method, params }),
  });
  const res = await POST(req);
  await res.text();
  return res.status;
}

// Um token novo por teste: a amostragem (1 a cada 10 s por credencial) não interfere.
const novoToken = () => createTestToken(empresa.id, empresa.adminMembroId);
const chamadas = () => events.filter((e) => e.nome === "vaga_aberta_api_chamada");

beforeAll(async () => {
  const u = await createTestUser();
  email = u.email;
  empresa = await createTestCompany(u);
});
beforeEach(() => {
  events = [];
  setAnalyticsSinkForTests((e) => events.push(e));
});
afterEach(() => {
  setAnalyticsSinkForTests(null);
  vi.restoreAllMocks();
});
afterAll(cleanup);

describe("pedido recusado pelo SDK (diagnóstico)", () => {
  it("versão de protocolo desconhecida: 400 e exatamente um log mcp_rejeitado, sem e-mail nem token", async () => {
    const token = await novoToken();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await rpc(token, "initialize", "2099-01-01", { protocolVersion: "2099-01-01", capabilities: {}, clientInfo: { name: "t", version: "1" } })).toBe(400);
    const logs = warn.mock.calls.filter((c) => c[0] === "mcp_rejeitado");
    expect(logs).toHaveLength(1);
    const info = logs[0][1] as Record<string, unknown>;
    expect(info).toMatchObject({ status: 400, metodo_http: "POST", metodo: "initialize", versao: "2099-01-01", user_agent: "Claude-User/1.0 (teste)" });
    expect(typeof info.erro).toBe("string");
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).not.toContain(email);
    expect(texto).not.toContain(token);
    expect(texto).not.toContain(token.slice(4));
  });
  it("pedido aceito não loga", async () => {
    const token = await novoToken();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await rpc(token, "tools/list")).toBe(200);
    expect(warn.mock.calls.filter((c) => c[0] === "mcp_rejeitado")).toHaveLength(0);
  });
  it("método fora do padrão curto não vai ao log", async () => {
    const token = await novoToken();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await rpc(token, "x".repeat(60) + "@exemplo.com", "2099-01-01");
    const info = warn.mock.calls.find((c) => c[0] === "mcp_rejeitado")?.[1] as Record<string, unknown>;
    expect(info.metodo).toBeNull();
  });
});

describe("contagem de uso (seção 21): só tools/call", () => {
  it("initialize + tools/list + notifications/initialized não geram evento", async () => {
    const token = await novoToken();
    expect(await rpc(token, "initialize", "2025-06-18", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } })).toBe(200);
    expect(await rpc(token, "notifications/initialized")).toBe(202);
    expect(await rpc(token, "tools/list")).toBe(200);
    await flushAnalytics();
    expect(chamadas()).toHaveLength(0);
  });
  it("um tools/call gera um evento", async () => {
    const token = await novoToken();
    expect(await rpc(token, "tools/call", "2025-06-18", { name: "quem_sou_eu", arguments: {} })).toBe(200);
    await flushAnalytics();
    expect(chamadas()).toHaveLength(1);
    expect(chamadas()[0].propriedades).toMatchObject({ rota: "/mcp", status: 200, porta: "mcp" });
  });
  it("pedido recusado não gera evento", async () => {
    const token = await novoToken();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await rpc(token, "tools/call", "2099-01-01", { name: "quem_sou_eu", arguments: {} })).toBe(400);
    await flushAnalytics();
    expect(chamadas()).toHaveLength(0);
  });
});

describe("protocolo 2026-07-28 (o Claude sonda com server/discover)", () => {
  // O SDK v2 já fala a 2026-07-28: com o envelope por pedido e o cabeçalho Mcp-Method, responde 200.
  it("server/discover completo dá 200 e não conta como uso", async () => {
    const token = await novoToken();
    const _meta = {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": { name: "t", version: "1" },
    };
    expect(await rpc(token, "server/discover", "2026-07-28", { _meta }, { "mcp-method": "server/discover" })).toBe(200);
    await flushAnalytics();
    expect(chamadas()).toHaveLength(0);
  });
});
