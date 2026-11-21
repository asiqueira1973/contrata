// API v1 de vagas (8.3; 13.2): escopos, criação com Idempotency-Key, 11.1 com erros por campo,
// PATCH e PUT de etapas, perguntas e equipe, publicar, pausar, encerrar (409 com candidatura em
// andamento, até o 8.6), resumo e filtros.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Validator } from "@seriousme/openapi-schema-validator";
import { db } from "@/server/db/client";
import { GET as listar, POST as criar } from "./vagas/route";
import { GET as ver, PATCH as editar } from "./vagas/[id]/route";
import { PUT as etapas } from "./vagas/[id]/etapas/route";
import { PUT as perguntas } from "./vagas/[id]/perguntas/route";
import { PUT as equipe } from "./vagas/[id]/equipe/route";
import { POST as publicar } from "./vagas/[id]/publicar/route";
import { POST as pausar } from "./vagas/[id]/pausar/route";
import { POST as encerrar } from "./vagas/[id]/encerrar/route";
import { GET as resumo } from "./vagas/[id]/resumo/route";
import { GET as openapiGet } from "./openapi.json/route";
import { apiRequest, cleanup, createArea, createTestApiKey, createTestCompany, createTestUser, params } from "../../../../tests/helpers";

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let leitura: string, escrita: string, decisao: string, loja: string;

const req = (path: string, tok: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) => {
  const r = apiRequest(path, { method, body, origin: null });
  r.headers.set("authorization", `Bearer ${tok}`);
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
  return r;
};
const vaga = (extra: Record<string, unknown> = {}) => ({
  titulo: "Atendente", area_id: loja, modelo_trabalho: "presencial", cidade: "Campinas", uf: "SP", regime: "clt",
  descricao: "Atendimento no balcão, organização da vitrine e apoio ao caixa nos fins de semana.", ...extra,
});

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  loja = await createArea(empresa, "Loja");
  leitura = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
  escrita = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
  decisao = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura", "escrita", "decisao"]);
});
afterAll(cleanup);

describe("API v1 — vagas", () => {
  let id: string;
  it("POST cria rascunho com as etapas padrão; leitura não cria (403)", async () => {
    expect((await criar(req("/api/v1/vagas", leitura, "POST", vaga()))).status).toBe(403);
    const r = await criar(req("/api/v1/vagas", escrita, "POST", vaga()));
    expect(r.status).toBe(201);
    const v = await r.json();
    id = v.id;
    expect(v).toMatchObject({ status: "rascunho", slug: "atendente", area_id: loja });
    expect(v.etapas.map((e: { nome: string }) => e.nome)).toEqual(["Triagem", "Entrevista com RH", "Entrevista com a gestão", "Proposta"]);
    const { data } = await db().from("rs_eventos").select("origem, ator_tipo").eq("vaga_id", id).eq("tipo", "vaga_criada").single();
    expect(data).toEqual({ origem: "api", ator_tipo: "api" });
  });
  it("Idempotency-Key repetida devolve 200 com a mesma vaga", async () => {
    const a = await criar(req("/api/v1/vagas", escrita, "POST", vaga({ titulo: "Com chave" }), { "idempotency-key": "k-1" }));
    const b = await criar(req("/api/v1/vagas", escrita, "POST", vaga({ titulo: "Com chave" }), { "idempotency-key": "k-1" }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect((await b.json()).id).toBe((await a.json()).id);
  });
  it("11.1 volta campo por campo (mesmo schema do formulário)", async () => {
    const r = await criar(req("/api/v1/vagas", escrita, "POST", vaga({ cidade: null, salario_min: 3000, salario_max: 2000, salario_periodo: "mes" })));
    expect(r.status).toBe(400);
    const b = await r.json();
    expect(b.codigo).toBe("dados_invalidos");
    expect(b.campos.map((c: { campo: string }) => c.campo)).toEqual(expect.arrayContaining(["cidade", "salario_max"]));
  });
  it("GET lista com filtro e GET por id; id inválido dá 404", async () => {
    const l = await (await listar(req(`/api/v1/vagas?status=rascunho&area_id=${loja}`, leitura))).json();
    expect(l.itens.length).toBeGreaterThanOrEqual(2);
    expect((await ver(req(`/api/v1/vagas/${id}`, leitura), params({ id }))).status).toBe(200);
    expect((await ver(req("/api/v1/vagas/x", leitura), params({ id: "x" }))).status).toBe(404);
    expect((await listar(req("/api/v1/vagas?status=aberta", leitura))).status).toBe(400);
  });
  it("PATCH muda só os campos enviados e recusa campos que não existem", async () => {
    const r = await editar(req(`/api/v1/vagas/${id}`, escrita, "PATCH", { titulo: "Atendente de loja", mostrar_salario: false }), params({ id }));
    expect(r.status).toBe(200);
    expect((await r.json()).titulo).toBe("Atendente de loja");
    expect((await editar(req(`/api/v1/vagas/${id}`, escrita, "PATCH", { etapas: [] }), params({ id }))).status).toBe(400);
  });
  it("PUT etapas, perguntas e equipe", async () => {
    const e = await etapas(req(`/api/v1/vagas/${id}/etapas`, escrita, "PUT", { etapas: [{ nome: "Triagem", tipo: "triagem" }, { nome: "Conversa", tipo: "entrevista" }] }), params({ id }));
    expect((await e.json()).etapas).toHaveLength(2);
    const p = await perguntas(req(`/api/v1/vagas/${id}/perguntas`, escrita, "PUT", { perguntas: [{ texto: "Tem CNH?", tipo: "sim_nao", resposta_esperada: "sim" }] }), params({ id }));
    expect((await p.json()).perguntas[0]).toMatchObject({ texto: "Tem CNH?", resposta_esperada: "sim" });
    const q = await equipe(req(`/api/v1/vagas/${id}/equipe`, escrita, "PUT", { responsavel: empresa.adminMembroId, avaliadores: [] }), params({ id }));
    expect((await q.json()).equipe).toEqual([{ membro_id: empresa.adminMembroId, papel_na_vaga: "responsavel" }]);
  });
  it("publicar e pausar (escrita); perguntas congeladas depois; resumo", async () => {
    expect((await publicar(req(`/api/v1/vagas/${id}/publicar`, escrita, "POST"), params({ id }))).status).toBe(200);
    const p = await perguntas(req(`/api/v1/vagas/${id}/perguntas`, escrita, "PUT", { perguntas: [] }), params({ id }));
    expect(p.status).toBe(409);
    expect((await p.json()).codigo).toBe("perguntas_congeladas");
    const s = await (await resumo(req(`/api/v1/vagas/${id}/resumo`, leitura), params({ id }))).json();
    expect(s.vaga.status).toBe("publicada");
    expect((await pausar(req(`/api/v1/vagas/${id}/pausar`, escrita, "POST"), params({ id }))).status).toBe(200);
  });
  it("encerrar exige escopo decisao e motivo; com candidatura em andamento dá 409 (decisão, 11.7)", async () => {
    expect((await encerrar(req(`/api/v1/vagas/${id}/encerrar`, escrita, "POST", { motivo: "preenchida" }), params({ id }))).status).toBe(403);
    expect((await encerrar(req(`/api/v1/vagas/${id}/encerrar`, decisao, "POST", {}), params({ id }))).status).toBe(400);
    const { data: c } = await db().from("rs_candidatos").insert({ empresa_id: empresa.id, email: `c-${empresa.slug}@teste.exemplo`, nome: "Pessoa" }).select("id").single();
    const { data: et } = await db().from("rs_etapas").select("id").eq("vaga_id", id).eq("ordem", 1).single();
    await db().from("rs_candidaturas").insert({ empresa_id: empresa.id, vaga_id: id, candidato_id: c!.id, etapa_id: et!.id, origem: "pagina", token_hash: `t-${id}`, consentimento_versao: "1", consentimento_em: new Date().toISOString(), recebida_em: new Date().toISOString() });
    const r = await encerrar(req(`/api/v1/vagas/${id}/encerrar`, decisao, "POST", { motivo: "preenchida" }), params({ id }));
    expect(r.status).toBe(409);
    expect((await r.json()).codigo).toBe("vaga_com_ativas");
    const outra = (await (await criar(req("/api/v1/vagas", escrita, "POST", vaga({ titulo: "Sem ninguém" })))).json()).id;
    const ok = await encerrar(req(`/api/v1/vagas/${outra}/encerrar`, decisao, "POST", { motivo: "cancelada" }), params({ id: outra }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "encerrada", motivo_encerramento: "cancelada" });
  });
  it("o documento OpenAPI continua válido com as rotas de vaga", async () => {
    const doc = await (await openapiGet()).json();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/vagas", "/vagas/{id}", "/vagas/{id}/encerrar"]));
    const res = await new Validator().validate(doc);
    expect(res.errors ?? []).toEqual([]);
  });
});
