// Decisões pelo conector (épico 8.6): formulário decisoes (reprovar em lote com a devolutiva
// editada no e-mail e o link derivado funcionando; devolutiva curta recusada; encerrar vaga com
// ativas; reabrir), propor_decisao só sem formulário e nunca executa, propostas (confirmar com
// "proposto por · confirmado por", alvo mudado vira expirada), salvar_* nunca visíveis ao modelo,
// mensagem com variável desconhecida recusada, modelos (personalizar, voltar ao padrão) e
// resposta de revisão (reabrir só pelo formulário).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { tokenDoLink } from "@/server/messages/link";
import { requireCandidaturaPorToken, requestReview, withdraw } from "@/server/recruiting/applications";
import { history } from "@/server/recruiting/pipeline";
import {
  COM_UI, SEM_UI, callTool, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestCompany, createTestToken, createTestUser, listTools,
} from "../../../tests/helpers";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string }, outra: { id: string; slug: string };
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;
const texto = (r: Awaited<ReturnType<typeof callTool>>) => ("content" in r ? r.content.map((c) => c.text).join(" ") : "");
const situacao = async (id: string) => (await db().from("rs_candidaturas").select("situacao").eq("id", id).single()).data!.situacao;
const DEVOLUTIVA = "Obrigado pelo seu tempo. Decidimos seguir com outras pessoas nesta etapa.";

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  outra = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  tokens.admin = await createTestToken(empresa.id, empresa.adminMembroId);
  tokens.escrita = await createTestToken(empresa.id, empresa.adminMembroId, ["leitura", "escrita"]);
  for (const [k, nome] of [["ana", "Ana Lima"], ["bia", "Bia Souza"], ["caio", "Caio Prado"], ["davi", "Davi Reis"]] as const) {
    ids[k] = await createReceivedApplication(empresa.id, vaga.id, { nome, email: `${k}@decisoes.exemplo` });
  }
  ids.eva = await createReceivedApplication(empresa.id, outra.id, { nome: "Eva Melo", email: "eva@decisoes.exemplo" });
});
afterAll(cleanup);

describe("visibilidade (princípio 2, 11.7)", () => {
  it("salvar_* só do app; decisões e propostas sem fallback; propor_decisao só sem formulário", async () => {
    for (const t of await listTools(tokens.admin, COM_UI)) {
      if (t.name.startsWith("salvar_")) expect(t._meta?.ui?.visibility, t.name).toEqual(["app"]);
    }
    const comUi = (await listTools(tokens.admin, COM_UI)).map((t) => t.name);
    expect(comUi).toContain("abrir_formulario_decisoes");
    expect(comUi).not.toContain("propor_decisao");
    const semUi = (await listTools(tokens.admin, SEM_UI)).map((t) => t.name);
    expect(semUi).toContain("propor_decisao");
    expect(semUi).not.toContain("registrar_decisoes");
    expect(semUi).not.toContain("registrar_propostas");
    expect(semUi).toContain("registrar_mensagem");
  });
  it("sem o escopo decisao, nem o formulário de decisões nem propor_decisao", async () => {
    const n = [...(await listTools(tokens.escrita, COM_UI)), ...(await listTools(tokens.escrita, SEM_UI))].map((t) => t.name);
    expect(n).not.toContain("abrir_formulario_decisoes");
    expect(n).not.toContain("propor_decisao");
  });
});

describe("formulário decisoes (11.5, 11.7)", () => {
  it("abrir traz o texto final de cada pessoa e o botão com o total", async () => {
    const f = estrutura(await callTool(tokens.admin, "abrir_formulario_decisoes", { candidaturas: [ids.ana, ids.bia], motivo: "requisitos" }));
    const itens = (f.valores as { itens: { texto: string; _titulo: string }[] }).itens;
    expect(itens).toHaveLength(2);
    expect(itens[0].texto).toContain("Olá, Ana.");
    expect(f.botao).toBe("Reprovar e enviar 2");
  });
  it("devolutiva curta volta marcada no item e nada muda", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_decisoes", { itens: [{ tipo: "reprovar", candidatura: ids.ana, motivo: "requisitos", assunto: "Sobre", texto: "Curta" }] }));
    expect(r.ok).toBe(false);
    expect((r.erros as { campo: string }[])[0].campo).toBe("itens.0.texto");
    expect(await situacao(ids.ana)).toBe("ativa");
  });
  it("reprova em lote com a devolutiva editada; o e-mail leva o rodapé de revisão e o link que funciona", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_decisoes", { itens: [
      { tipo: "reprovar", candidatura: ids.ana, motivo: "requisitos", assunto: "Sobre sua candidatura", texto: DEVOLUTIVA },
      { tipo: "reprovar", candidatura: ids.bia, motivo: "experiencia", assunto: "Sobre sua candidatura", texto: DEVOLUTIVA },
    ] }));
    expect(r.ok).toBe(true);
    expect(await situacao(ids.ana)).toBe("reprovada");
    const email = emails.find((e) => e.to === "ana@decisoes.exemplo")!;
    expect(email.text).toContain(DEVOLUTIVA);
    expect(email.text).toContain("pedir uma revisão");
    const token = email.text.match(/\/c\/([A-Za-z0-9_-]{43})/)![1];
    expect((await requireCandidaturaPorToken(token))?.id).toBe(ids.ana);
    const { data: m } = await db().from("rs_mensagens").select("corpo").eq("candidatura_id", ids.ana).eq("tipo", "devolutiva").single();
    expect(m!.corpo).not.toContain(token);
    const { data: n } = await db().from("rs_notificacoes").select("html, texto, status").eq("candidatura_id", ids.ana).eq("tipo", "mensagem_candidato").single();
    expect(n!.status).toBe("enviada");
    expect(`${n!.html}${n!.texto}`).toBe("");
  });
  it("o motivo interno não aparece para o candidato", async () => {
    const email = emails.find((e) => e.to === "bia@decisoes.exemplo")!;
    expect(email.text).not.toMatch(/experi(ê|e)ncia insuficiente|experiencia/i);
  });
  it("reabrir pelo formulário volta a candidatura a ativa, sem e-mail", async () => {
    const antes = emails.length;
    const r = estrutura(await callTool(tokens.admin, "salvar_decisoes", { itens: [{ tipo: "reabrir", candidatura: ids.ana }] }));
    expect(r.ok).toBe(true);
    expect(await situacao(ids.ana)).toBe("ativa");
    expect(emails.length).toBe(antes);
  });
});

describe("propostas (11.7, 12.3)", () => {
  it("propor_decisao sem formulário cria proposta e nunca executa", async () => {
    const r = await callTool(tokens.admin, "propor_decisao", { tipo: "reprovar", candidaturas: [ids.caio], motivo: "perfil", devolutiva: DEVOLUTIVA, justificativa: "Sem a experiência pedida." }, SEM_UI);
    expect(texto(r)).toContain("Proposta criada");
    expect(await situacao(ids.caio)).toBe("ativa");
    const curta = await callTool(tokens.admin, "propor_decisao", { tipo: "reprovar", candidaturas: [ids.davi], motivo: "perfil", devolutiva: "curta" }, SEM_UI);
    expect("isError" in curta && curta.isError).toBe(true);
  });
  it("o formulário de propostas confirma; o histórico diz quem propôs e quem confirmou", async () => {
    const f = estrutura(await callTool(tokens.admin, "abrir_formulario_propostas"));
    const itens = (f.valores as { itens: { decisao: string; _info: string }[] }).itens;
    expect(itens).toHaveLength(1);
    expect(itens[0]._info).toMatch(/Proposto por .* · em nome de /);
    const r = estrutura(await callTool(tokens.admin, "salvar_propostas", { itens: [{ decisao: itens[0].decisao, acao: "confirmar", assunto: "Sobre sua candidatura", texto: `${DEVOLUTIVA} Boa sorte!` }] }));
    expect(r.ok).toBe(true);
    expect(await situacao(ids.caio)).toBe("reprovada");
    expect(emails.find((e) => e.to === "caio@decisoes.exemplo")!.text).toContain("Boa sorte!");
    const h = await history({ empresa: { id: empresa.id, slug: empresa.slug }, ator: { tipo: "api", origem: "api" }, alcance: { tipo: "todas" } }, ids.caio);
    const conf = h.eventos.find((e) => e.tipo === "decisao_confirmada")!;
    expect(conf.por).toMatch(/^proposto por .* · em nome de .* · confirmado por /);
  });
  it("proposta cujo alvo mudou vira expirada e não executa", async () => {
    await callTool(tokens.admin, "propor_decisao", { tipo: "contratar", candidaturas: [ids.davi] }, SEM_UI);
    await withdraw(tokenDoLink(ids.davi, 0)); // a pessoa retira a candidatura pelo próprio link
    const f = estrutura(await callTool(tokens.admin, "abrir_formulario_propostas"));
    const item = (f.valores as { itens: { decisao: string; _aviso?: string }[] }).itens[0];
    expect(item._aviso).toBe("Esta proposta não vale mais: a candidatura já foi encerrada.");
    const r = estrutura(await callTool(tokens.admin, "salvar_propostas", { itens: [{ decisao: item.decisao, acao: "confirmar" }] }));
    expect(String(r.resumo)).toContain("Não valiam mais");
    const { data } = await db().from("rs_decisoes").select("status").eq("id", item.decisao).single();
    expect(data!.status).toBe("expirada");
  });
});

describe("encerrar vaga com ativas (11.5)", () => {
  it("cada pessoa em andamento recebe a devolutiva com o próprio nome; a vaga encerra", async () => {
    const f = estrutura(await callTool(tokens.admin, "abrir_formulario_decisoes", { acao: "encerrar_vaga", vaga: outra.id }));
    const item = (f.valores as { itens: { texto: string; _aviso: string; vaga: string; motivo_encerramento: string }[] }).itens[0];
    expect(item._aviso).toBe("1 pessoa em andamento vai receber esta mensagem.");
    const r = estrutura(await callTool(tokens.admin, "salvar_decisoes", { itens: [{ tipo: "encerrar_vaga", vaga: outra.id, motivo_encerramento: "preenchida", assunto: "Sobre {{vaga}}", texto: item.texto }] }));
    expect(r.ok).toBe(true);
    expect(await situacao(ids.eva)).toBe("encerrada_vaga");
    expect(emails.find((e) => e.to === "eva@decisoes.exemplo")!.text).toContain("Olá, Eva.");
    const { data } = await db().from("rs_vagas").select("status").eq("id", outra.id).single();
    expect(data!.status).toBe("encerrada");
  });
});

describe("mensagens e modelos (11.8, 11.29)", () => {
  it("variável desconhecida é recusada; a mensagem sai com as variáveis trocadas", async () => {
    const ruim = estrutura(await callTool(tokens.admin, "salvar_mensagem", { candidatura: ids.ana, assunto: "Oi", corpo: "Olá {{apelido}}" }));
    expect(ruim.ok).toBe(false);
    const ok = estrutura(await callTool(tokens.admin, "salvar_mensagem", { candidatura: ids.ana, assunto: "Entrevista para {{vaga}}", corpo: "Olá, {{nome}}. Acompanhe: {{link_acompanhamento}}" }));
    expect(ok.ok).toBe(true);
    const e = emails.filter((x) => x.to === "ana@decisoes.exemplo").at(-1)!;
    expect(e.text).toMatch(/Olá, Ana\. Acompanhe: http:\/\/localhost:3050\/c\/[A-Za-z0-9_-]{43}/);
    const { data } = await db().from("rs_mensagens").select("corpo").eq("candidatura_id", ids.ana).eq("tipo", "contato").single();
    expect(data!.corpo).toBe("Olá, Ana. Acompanhe: {{link_acompanhamento}}");
  });
  it("personalizar um modelo e voltar ao padrão", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_modelos_mensagem", { operacao: "editar", modelo: "devolutiva_padrao", nome: "Devolutiva", assunto: "Retorno — {{vaga}}", corpo: "Olá, {{nome}}. Seguimos com outras pessoas." }));
    expect(String(r.resumo)).toContain("Prévia com dados fictícios — Retorno — Analista financeiro: Olá, Marina.");
    const lista = estrutura(await callTool(tokens.admin, "listar_modelos_mensagem")).itens as { chave: string; personalizado: boolean }[];
    expect(lista.find((m) => m.chave === "devolutiva_padrao")!.personalizado).toBe(true);
    await callTool(tokens.admin, "salvar_modelos_mensagem", { operacao: "padrao", modelo: "devolutiva_padrao" });
    const de_novo = estrutura(await callTool(tokens.admin, "listar_modelos_mensagem")).itens as { chave: string; personalizado: boolean }[];
    expect(de_novo.find((m) => m.chave === "devolutiva_padrao")!.personalizado).toBe(false);
  });
});

describe("link de quem se candidatou antes do link derivado (decisão 1 do 8.6)", () => {
  it("a mensagem sai com um link que funciona mesmo que o banco tenha o hash antigo", async () => {
    const id = await createReceivedApplication(empresa.id, vaga.id, { nome: "Gil Antigo", email: "gil@decisoes.exemplo" });
    await db().from("rs_candidaturas").update({ token_hash: `antigo-${id}` }).eq("id", id);
    const ok = estrutura(await callTool(tokens.admin, "salvar_mensagem", { candidatura: id, assunto: "Oi", corpo: "Acompanhe: {{link_acompanhamento}}" }));
    expect(ok.ok).toBe(true);
    const token = emails.filter((e) => e.to === "gil@decisoes.exemplo").at(-1)!.text.match(/\/c\/([A-Za-z0-9_-]{43})/)![1];
    expect((await requireCandidaturaPorToken(token))?.id).toBe(id);
  });
});

describe("revisão (11.13)", () => {
  it("o pedido avisa a equipe; a resposta sem formulário não reabre; com formulário reabre", async () => {
    const token = emails.find((e) => e.to === "bia@decisoes.exemplo")!.text.match(/\/c\/([A-Za-z0-9_-]{43})/)![1];
    await requestReview(token, "Tenho a certificação que vocês pediram.");
    const aviso = emails.find((e) => e.subject.startsWith("Bia Souza pediu revisão — "))!;
    expect(aviso.text).toContain("Tenho a certificação que vocês pediram.");
    await expect(requestReview(token, null)).rejects.toThrow();
    const semForm = await callTool(tokens.admin, "registrar_resposta_revisao", { candidatura: ids.bia, assunto: "Revisão", corpo: "Revimos e vamos seguir com você.", reabrir: true }, SEM_UI);
    expect(JSON.stringify(semForm)).toContain("so_no_formulario");
    const r = estrutura(await callTool(tokens.admin, "salvar_resposta_revisao", { candidatura: ids.bia, assunto: "Revisão", corpo: "Revimos e vamos seguir com você.", reabrir: true }));
    expect(r.ok).toBe(true);
    expect(await situacao(ids.bia)).toBe("ativa");
  });
});
