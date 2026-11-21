// API v1 do funil (8.5; 13.2): leitura lista, filtra, busca e vê (com todas as avaliações, 11.9);
// currículo em texto e em URL de 5 min; escrita move (uma e em lote, tudo ou nada, 11.30) e
// anota com "Integração · {chave}" no histórico; a API não avalia; OpenAPI válido.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { db } from "@/server/db/client";
import { history } from "@/server/recruiting/pipeline";
import { GET as listar, POST as criar } from "./candidaturas/route";
import { POST as concluir } from "./candidaturas/[id]/concluir/route";
import { GET as ver } from "./candidaturas/[id]/route";
import { GET as curriculo } from "./candidaturas/[id]/curriculo/route";
import { POST as mover } from "./candidaturas/[id]/mover/route";
import { POST as moverLote } from "./candidaturas/mover/route";
import { POST as anotar } from "./candidaturas/[id]/notas/route";
import { GET as openapiGet } from "./openapi.json/route";
import { PUT as trocarEtapas } from "./vagas/[id]/etapas/route";
import {
  apiRequest, cleanup, createPublishedJob, createReceivedApplication, createTestApiKey, createTestCompany, createTestUser, params, uploadTo,
} from "../../../../tests/helpers";
import { pdf } from "../../../../tests/fixtures/curriculos";

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string }, outra: { id: string; slug: string };
let leitura: string, escrita: string;
let entrevista: string;
const ids: Record<string, string> = {};

const req = (path: string, tok: string, method = "GET", body?: unknown) => {
  const r = apiRequest(path, { method, body, origin: null });
  r.headers.set("authorization", `Bearer ${tok}`);
  return r;
};
const nomes = async (r: Response) => ((await r.json()).itens as { nome: string }[]).map((i) => i.nome).sort();

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  outra = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  leitura = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
  escrita = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
  const { data } = await db().from("rs_etapas").select("id").eq("vaga_id", vaga.id).eq("nome", "Entrevista").single();
  entrevista = data!.id;
  ids.bia = await createReceivedApplication(empresa.id, vaga.id, { nome: "Bia Santos", email: "bia@api-funil.exemplo" });
  ids.davi = await createReceivedApplication(empresa.id, outra.id, { nome: "Davi Rocha", email: "davi@api-funil.exemplo" });
  // Ana pela própria API, com currículo.
  const c = await (await criar(req("/api/v1/candidaturas", escrita, "POST", {
    vaga_id: vaga.id, nome: "Ana Lima", email: "ana@api-funil.exemplo", aceite_privacidade: true,
    curriculo: { nome: "cv.pdf", tipo: "application/pdf", bytes: 1000 },
  }))).json();
  await uploadTo(c.upload_url, pdf("Experiencia em confeitaria"));
  await concluir(req(`/api/v1/candidaturas/${c.id}/concluir`, escrita, "POST", { concluir_token: c.concluir_token }), params({ id: c.id }));
  ids.ana = c.id;
});
afterAll(cleanup);

describe("API v1 — funil", () => {
  it("leitura lista, filtra por vaga e busca no currículo", async () => {
    expect(await nomes(await listar(req("/api/v1/candidaturas", leitura)))).toEqual(["Ana Lima", "Bia Santos", "Davi Rocha"]);
    expect(await nomes(await listar(req(`/api/v1/candidaturas?vaga_id=${outra.id}`, leitura)))).toEqual(["Davi Rocha"]);
    expect(await nomes(await listar(req("/api/v1/candidaturas?q=confeitaria", leitura)))).toEqual(["Ana Lima"]);
    expect((await listar(req("/api/v1/candidaturas?vaga_id=x", leitura))).status).toBe(400);
  });
  it("currículo em texto e, com formato=arquivo, URL de 5 min", async () => {
    const t = await (await curriculo(req(`/api/v1/candidaturas/${ids.ana}/curriculo`, leitura), params({ id: ids.ana }))).json();
    expect(t.curriculo.texto).toContain("confeitaria");
    expect(t.curriculo.url).toBeUndefined();
    const a = await (await curriculo(req(`/api/v1/candidaturas/${ids.ana}/curriculo?formato=arquivo`, leitura), params({ id: ids.ana }))).json();
    expect(a.curriculo.url).toBeTruthy();
    expect(a.curriculo.texto).toBeUndefined();
  });
  it("leitura não move nem anota (403); escrita move e anota", async () => {
    expect((await mover(req(`/api/v1/candidaturas/${ids.bia}/mover`, leitura, "POST", { etapa_id: entrevista }), params({ id: ids.bia }))).status).toBe(403);
    expect((await anotar(req(`/api/v1/candidaturas/${ids.bia}/notas`, leitura, "POST", { texto: "x" }), params({ id: ids.bia }))).status).toBe(403);
    const m = await mover(req(`/api/v1/candidaturas/${ids.bia}/mover`, escrita, "POST", { etapa_id: entrevista }), params({ id: ids.bia }));
    expect(await m.json()).toEqual({ movidas: 1, etapa: { id: entrevista, nome: "Entrevista" } });
    const n = await anotar(req(`/api/v1/candidaturas/${ids.bia}/notas`, escrita, "POST", { texto: "Referências conferidas." }), params({ id: ids.bia }));
    expect(n.status).toBe(201);
  });
  it("o histórico assina a nota e a movimentação como Integração · {chave}", async () => {
    const { data: chave } = await db().from("rs_credenciais").select("nome").eq("empresa_id", empresa.id).eq("tipo", "api").contains("escopos", ["escrita"]).single();
    const h = await history({ empresa: { id: empresa.id, slug: empresa.slug }, ator: { tipo: "api", origem: "api" }, alcance: { tipo: "todas" } }, ids.bia);
    const por = h.eventos.filter((e) => ["nota_adicionada", "etapa_alterada"].includes(e.tipo)).map((e) => e.por);
    expect(por).toEqual([`Integração · ${chave!.nome}`, `Integração · ${chave!.nome}`]);
  });
  it("lote com outra vaga é recusado inteiro; ver traz a nota e a etapa", async () => {
    const r = await moverLote(req("/api/v1/candidaturas/mover", escrita, "POST", { ids: [ids.ana, ids.davi], etapa_id: entrevista }));
    expect(r.status).toBe(409);
    const ana = await (await ver(req(`/api/v1/candidaturas/${ids.ana}`, leitura), params({ id: ids.ana }))).json();
    expect(ana.etapa.nome).toBe("Triagem");
    const bia = await (await ver(req(`/api/v1/candidaturas/${ids.bia}`, leitura), params({ id: ids.bia }))).json();
    expect(bia.etapa.nome).toBe("Entrevista");
    expect(bia.notas.map((x: { texto: string }) => x.texto)).toEqual(["Referências conferidas."]);
  });
  it("atualizada_desde traz só o que mudou depois", async () => {
    const corte = new Date().toISOString();
    await anotar(req(`/api/v1/candidaturas/${ids.bia}/notas`, escrita, "POST", { texto: "Pediu retorno até sexta." }), params({ id: ids.bia }));
    expect(await nomes(await listar(req(`/api/v1/candidaturas?atualizada_desde=${encodeURIComponent(corte)}`, leitura)))).toEqual(["Bia Santos"]);
  });
  it("11.22: com candidaturas, renomear e reordenar etapas funciona; tirar etapa com candidatura pede para mover antes", async () => {
    const { data: etapas } = await db().from("rs_etapas").select("id, nome, tipo").eq("vaga_id", vaga.id).order("ordem");
    const [triagem, entrev] = etapas!;
    const renomeada = await trocarEtapas(req(`/api/v1/vagas/${vaga.id}/etapas`, escrita, "PUT", {
      etapas: [{ id: entrev.id, nome: "Entrevista com RH", tipo: entrev.tipo }, { id: triagem.id, nome: "Triagem inicial", tipo: triagem.tipo }],
    }), params({ id: vaga.id }));
    expect(renomeada.status).toBe(200);
    expect((await renomeada.json()).etapas.map((e: { nome: string }) => e.nome)).toEqual(["Entrevista com RH", "Triagem inicial"]);
    const sem = await trocarEtapas(req(`/api/v1/vagas/${vaga.id}/etapas`, escrita, "PUT", {
      etapas: [{ id: entrev.id, nome: "Entrevista com RH", tipo: entrev.tipo }],
    }), params({ id: vaga.id }));
    expect(sem.status).toBe(409);
    expect((await sem.json()).mensagem).toContain("Mova as candidaturas antes");
  });
  it("OpenAPI válido, com as rotas do funil e nenhuma de avaliação", async () => {
    const doc = await (await openapiGet()).json();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/candidaturas/{id}", "/candidaturas/{id}/curriculo", "/candidaturas/mover", "/candidaturas/{id}/notas"]));
    expect(Object.keys(doc.paths).some((p) => p.includes("avalia"))).toBe(false);
    expect((await new Validator().validate(doc)).valid).toBe(true);
  });
});
