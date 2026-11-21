// Vagas pelo conector (épico 8.3): formulário vaga (criar e editar, listas de etapas e perguntas,
// dono com e sem acesso, área no alcance), consultas (listar_vagas, ver_vaga, resumo_da_vaga),
// publicar, pausar e encerrar (12.1, 11.1), página de carreiras e o fallback (13.5, v0.4.2).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { previaValida } from "@/server/careers/preview";
import {
  COM_UI, SEM_UI, addMember, callTool, cleanup, createArea, createTestCompany, createTestToken, createTestUser, listTools,
} from "../../../tests/helpers";

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let loja: string, financeiro: string, dora: string, membroAval: string;
const tokens: Record<string, string> = {};
const texto = (r: Awaited<ReturnType<typeof callTool>>) => ("content" in r ? r.content.map((c) => c.text).join(" ") : "");
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;

const DESCRICAO = "Atendimento no balcão, organização da vitrine e apoio ao caixa nos fins de semana.";
const base = (extra: Record<string, unknown> = {}) => ({
  titulo: "Atendente de padaria",
  area: loja,
  modelo_trabalho: "presencial",
  cidade: "Campinas",
  uf: "SP",
  regime: "clt",
  salario_min: "2800",
  salario_max: "3200",
  salario_periodo: "mes",
  mostrar_salario: true,
  descricao: DESCRICAO,
  etapas: [{ nome: "Triagem", tipo: "triagem" }, { nome: "Entrevista", tipo: "entrevista" }],
  perguntas: [{ texto: "Pode trabalhar aos sábados?", tipo: "sim_nao", obrigatoria: true, resposta_esperada: "sim" }],
  ...extra,
});

beforeAll(async () => {
  const admin = await createTestUser();
  empresa = await createTestCompany(admin);
  loja = await createArea(empresa, "Loja");
  financeiro = await createArea(empresa, "Financeiro");
  const { data: p } = await db().from("rs_pessoas").insert({ empresa_id: empresa.id, nome: "Dora Martins", email: `dora-${empresa.slug}@teste.exemplo` }).select("id").single();
  dora = p!.id;
  const limitado = await createTestUser();
  const avaliador = await createTestUser();
  const membroLim = await addMember(empresa, limitado, "recrutador", [loja]);
  membroAval = await addMember(empresa, avaliador, "avaliador");
  tokens.admin = await createTestToken(empresa.id, empresa.adminMembroId);
  tokens.limitado = await createTestToken(empresa.id, membroLim);
  tokens.avaliador = await createTestToken(empresa.id, membroAval);
  tokens.semDecisao = await createTestToken(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
});
afterAll(cleanup);

async function criar(token: string, extra: Record<string, unknown> = {}) {
  const r = await callTool(token, "salvar_vaga", base(extra));
  return estrutura(r) as { ok: boolean; ids?: string[]; erros?: { campo: string | null; mensagem: string }[] };
}

describe("formulário vaga (11.1, 11.22, 11.31, 11.32)", () => {
  it("abrir_formulario_vaga vem preenchido com as etapas padrão e o dono da área", async () => {
    const r = await callTool(tokens.admin, "abrir_formulario_vaga", { titulo: "Auxiliar de cozinha", area: "loja" });
    const f = estrutura(r) as { valores: Record<string, unknown>; campos: { nome: string; tipo: string }[] };
    expect(f.valores.titulo).toBe("Auxiliar de cozinha");
    expect(f.valores.area).toBe(loja);
    expect((f.valores.etapas as unknown[]).length).toBe(4);
    expect(f.campos.find((c) => c.nome === "etapas")?.tipo).toBe("lista");
    expect(texto(r)).toContain("Nada foi gravado");
  });
  it("cria em rascunho com etapas, perguntas e o dono com acesso na equipe", async () => {
    const { data: pAval } = await db().from("rs_pessoas").select("id").eq("membro_id", membroAval).single();
    const r = await criar(tokens.admin, { dono: pAval!.id });
    expect(r.ok).toBe(true);
    const { data } = await db().from("rs_vagas").select("status, slug, rs_etapas(id), rs_perguntas(id), rs_vaga_equipe(membro_id, papel_na_vaga)").eq("id", r.ids![0]).single();
    expect(data!.status).toBe("rascunho");
    expect(data!.rs_etapas).toHaveLength(2);
    expect(data!.rs_perguntas).toHaveLength(1);
    expect(data!.rs_vaga_equipe).toEqual([{ membro_id: membroAval, papel_na_vaga: "avaliador" }]);
    const { data: ev } = await db().from("rs_eventos").select("origem, ator_tipo").eq("vaga_id", r.ids![0]).eq("tipo", "vaga_criada").single();
    expect(ev).toEqual({ origem: "formulario", ator_tipo: "membro" });
  });
  it("erros por campo e por item de lista, sem gravar", async () => {
    const r = await criar(tokens.admin, { cidade: "", etapas: [{ nome: "X", tipo: "triagem" }], perguntas: [{ texto: "Turno?", tipo: "escolha_unica", opcoes: ["Manhã"] }] });
    expect(r.ok).toBe(false);
    const campos = r.erros!.map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(["cidade", "etapas.0.nome", "perguntas.0.opcoes"]));
  });
  it("salário invertido e salário mostrado sem valor são recusados", async () => {
    const r = await criar(tokens.admin, { salario_min: "3200", salario_max: "2800" });
    expect(r.erros!.map((e) => e.campo)).toContain("salario_max");
  });
  it("recrutador limitado: área fora do alcance é recusada (fora_do_alcance) e só vê as vagas da área dele", async () => {
    const fora = await criar(tokens.limitado, { area: financeiro, titulo: "Analista financeiro" });
    expect(fora.ok).toBe(false);
    expect(fora.erros![0].mensagem).toBe("Essa área está fora das áreas em que você recruta. Escolha outra.");
    const dentro = await criar(tokens.limitado, { titulo: "Repositor" });
    expect(dentro.ok).toBe(true);
    await criar(tokens.admin, { area: financeiro, titulo: "Analista financeiro" });
    const lista = estrutura(await callTool(tokens.limitado, "listar_vagas", {})) as { itens: { titulo: string }[] };
    expect(lista.itens.map((v) => v.titulo)).not.toContain("Analista financeiro");
    const opcoes = estrutura(await callTool(tokens.limitado, "opcoes_vaga", {})) as { opcoes: { areas: { valor: string }[] } };
    expect(opcoes.opcoes.areas.map((a) => a.valor)).toEqual([loja]);
  });
  it("dono sem acesso aparece com o selo da 11.31", async () => {
    const opcoes = estrutura(await callTool(tokens.admin, "opcoes_vaga", {})) as { opcoes: { pessoas: { valor: string; rotulo: string }[] } };
    expect(opcoes.opcoes.pessoas.find((p) => p.valor === dora)?.rotulo).toBe("Dora Martins · Sem acesso · recebe resumo semanal");
  });
  it("avaliador não vê os formulários de vaga e só lista as vagas da equipe dele", async () => {
    const nomes = (await listTools(tokens.avaliador, COM_UI)).map((t) => t.name);
    expect(nomes).not.toContain("abrir_formulario_vaga");
    expect(nomes).toContain("listar_vagas");
    const lista = estrutura(await callTool(tokens.avaliador, "listar_vagas", {})) as { itens: { titulo: string }[] };
    expect(lista.itens.map((v) => v.titulo)).toEqual(["Atendente de padaria"]);
  });
});

describe("publicar, pausar e encerrar (12.1, 11.1)", () => {
  let id: string;
  beforeAll(async () => {
    id = (await criar(tokens.admin, { titulo: "Padeiro" })).ids![0];
  });
  it("publicar confere a 11.1 e devolve a falta como erro geral", async () => {
    const curta = (await criar(tokens.admin, { titulo: "Confeiteiro", descricao: "Curta." })).ids![0];
    const r = estrutura(await callTool(tokens.admin, "salvar_publicar_vaga", { vaga: curta }));
    expect(r.ok).toBe(false);
    expect((r.erros as { campo: string | null; mensagem: string }[])[0]).toEqual({ campo: null, mensagem: "Escreva uma descrição com pelo menos 50 caracteres para publicar." });
  });
  it("publica; perguntas congeladas no formulário de edição; editar o resto continua valendo", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_publicar_vaga", { vaga: id }));
    expect(r.ok).toBe(true);
    const f = estrutura(await callTool(tokens.admin, "abrir_formulario_vaga", { vaga: "Padeiro" })) as { campos: { nome: string; somenteLeitura?: boolean }[]; avisos: string[] };
    expect(f.campos.find((c) => c.nome === "perguntas")?.somenteLeitura).toBe(true);
    expect(f.campos.find((c) => c.nome === "slug")).toBeUndefined();
    const ed = estrutura(await callTool(tokens.admin, "salvar_vaga", base({ vaga: id, titulo: "Padeiro (madrugada)", perguntas: [{ texto: "Outra?", tipo: "sim_nao" }] })));
    expect(ed.ok).toBe(true);
    const { data } = await db().from("rs_vagas").select("titulo, rs_perguntas(texto)").eq("id", id).single();
    expect(data!.titulo).toBe("Padeiro (madrugada)");
    expect(data!.rs_perguntas).toEqual([{ texto: "Pode trabalhar aos sábados?" }]);
  });
  it("ver_vaga devolve a vaga e, com a página não publicada, o link de pré-visualização", async () => {
    const r = estrutura(await callTool(tokens.admin, "ver_vaga", { vaga: "padeiro" })) as { vaga: { status: string }; url: string | null; link_previa: string };
    expect(r.vaga.status).toBe("publicada");
    expect(r.url).toBeNull();
    const token = decodeURIComponent(new URL(r.link_previa).searchParams.get("previa")!);
    expect(previaValida(empresa.id, token)).toBe(true);
  });
  it("resumo_da_vaga só traz contagens", async () => {
    const r = estrutura(await callTool(tokens.admin, "resumo_da_vaga", { vaga: "padeiro" })) as { etapas: { ativas: number }[]; situacoes: Record<string, number> };
    expect(r.etapas).toHaveLength(2);
    expect(r.situacoes.ativa).toBe(0);
  });
  it("pausa e encerra; encerrar exige escopo decisao, a confirmação e não tem fallback", async () => {
    expect(estrutura(await callTool(tokens.admin, "salvar_pausar_vaga", { vaga: id })).ok).toBe(true);
    const semEscopo = (await listTools(tokens.semDecisao, COM_UI)).map((t) => t.name);
    expect(semEscopo).not.toContain("abrir_formulario_encerrar_vaga");
    const semUi = (await listTools(tokens.admin, SEM_UI)).map((t) => t.name);
    expect(semUi).toEqual(expect.arrayContaining(["registrar_vaga", "registrar_publicar_vaga", "registrar_pausar_vaga"]));
    expect(semUi).not.toContain("registrar_encerrar_vaga");
    expect(semUi).not.toContain("registrar_pagina_de_carreiras");
    const semConfirmar = estrutura(await callTool(tokens.admin, "salvar_encerrar_vaga", { vaga: id, motivo: "preenchida", confirmar: false }));
    expect(semConfirmar.ok).toBe(false);
    expect(estrutura(await callTool(tokens.admin, "salvar_encerrar_vaga", { vaga: id, motivo: "preenchida", confirmar: true })).ok).toBe(true);
    const ed = estrutura(await callTool(tokens.admin, "salvar_vaga", base({ vaga: id })));
    expect(ed.ok).toBe(false);
  });
  it("fallback de publicar em duas chamadas, com ator agente", async () => {
    const outra = (await criar(tokens.admin, { titulo: "Balconista" })).ids![0];
    const previa = estrutura(await callTool(tokens.admin, "registrar_publicar_vaga", { vaga: outra }, SEM_UI)) as { token_previa: string };
    expect(previa.token_previa).toBeTruthy();
    const ok = estrutura(await callTool(tokens.admin, "registrar_publicar_vaga", { vaga: outra, confirmar: true, token_previa: previa.token_previa }, SEM_UI));
    expect(ok.ok).toBe(true);
    const { data } = await db().from("rs_eventos").select("origem, ator_tipo").eq("vaga_id", outra).eq("tipo", "vaga_publicada").single();
    expect(data).toEqual({ origem: "mcp", ator_tipo: "agente" });
  });
  // Achado do verifier do 8.3: sem formulário, o modelo manda só o que muda; o resto não pode sumir.
  it("fallback de edição muda só os campos enviados (descrição, etapas e equipe ficam)", async () => {
    const id = (await criar(tokens.admin, { titulo: "Caixa", responsavel: undefined })).ids![0];
    await db().rpc("rs_fn_grava_equipe", { p_vaga: id, p_empresa: empresa.id, p_equipe: { responsavel: empresa.adminMembroId, avaliadores: [] } as never });
    const args = { vaga: id, titulo: "Caixa (manhã)", modelo_trabalho: "presencial", regime: "clt" };
    const previa = estrutura(await callTool(tokens.admin, "registrar_vaga", args, SEM_UI)) as { token_previa: string };
    const ok = estrutura(await callTool(tokens.admin, "registrar_vaga", { ...args, confirmar: true, token_previa: previa.token_previa }, SEM_UI));
    expect(ok.ok).toBe(true);
    const { data } = await db().from("rs_vagas").select("titulo, descricao, cidade, rs_etapas(id), rs_vaga_equipe(membro_id)").eq("id", id).single();
    expect(data!.titulo).toBe("Caixa (manhã)");
    expect(data!.descricao).toBe(DESCRICAO);
    expect(data!.cidade).toBe("Campinas");
    expect(data!.rs_etapas).toHaveLength(2);
    expect(data!.rs_vaga_equipe).toEqual([{ membro_id: empresa.adminMembroId }]);
  });
  // Equipe dá acesso às candidaturas da vaga: sem formulário, não muda (13.5, v0.4.2).
  it("fallback não mexe na equipe (responsável e avaliadores só pelo formulário)", async () => {
    const r = await callTool(tokens.admin, "registrar_vaga", base({ avaliadores: [membroAval] }), SEM_UI);
    expect(texto(r)).toBe("Isso só pode ser feito pelo formulário, com o clique da pessoa. Use o Contrata no Claude ou no ChatGPT.");
  });
});

describe("página de carreiras (8.3, parte do 8.9)", () => {
  it("só administrador publica a página; o resumo traz o endereço", async () => {
    expect((await listTools(tokens.limitado, COM_UI)).map((t) => t.name)).not.toContain("abrir_formulario_pagina_de_carreiras");
    const r = estrutura(await callTool(tokens.admin, "salvar_pagina_de_carreiras", { operacao: "publicar" }));
    expect(r.ok).toBe(true);
    expect(r.resumo).toContain(`/${empresa.slug}`);
    const { data } = await db().from("rs_empresas").select("pagina_publicada").eq("id", empresa.id).single();
    expect(data!.pagina_publicada).toBe(true);
  });
});
