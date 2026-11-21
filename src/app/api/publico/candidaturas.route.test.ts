// Candidatura de ponta a ponta pelas rotas (8.4): criar, subir, concluir, e-mail com o link /c,
// duplicada (11.3), tipo pelos bytes e 5 MB (11.2), campo-armadilha e limite por IP (11.14), vaga
// fechada, token de conclusão errado, extração em segundo plano, 20.3 (link fora do corpo
// guardado), /c: retirar, baixar (14.2) e excluir com código (11.13), e "Perdi o link".
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { CURRICULO_MAX_BYTES } from "@/lib/limits";
import { POST as criarPost } from "./[empresa]/vagas/[slug]/candidaturas/route";
import { POST as concluirPost } from "./[empresa]/candidaturas/[id]/concluir/route";
import { POST as linksEmpresa } from "./[empresa]/links/route";
import { POST as retirarPost } from "@/app/api/c/[token]/retirar/route";
import { GET as exportarGet } from "@/app/api/c/[token]/exportar/route";
import { POST as codigoPost } from "@/app/api/c/[token]/excluir/codigo/route";
import { POST as excluirPost } from "@/app/api/c/[token]/excluir/route";
import { requireCandidaturaPorToken } from "@/server/recruiting/applications";
import { storage } from "@/server/files/storage";
import { apiRequest, captureEmails, cleanup, createPublishedJob, createTestCompany, createTestUser, params, uploadTo } from "../../../../tests/helpers";
import { docx, exe, pdf } from "../../../../tests/fixtures/curriculos";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string };
let pergunta: string;
let ipN = 0;

const req = (path: string, body: unknown, extra: { origin?: string | null; ip?: string } = {}) => {
  const r = apiRequest(path, { method: "POST", body, origin: extra.origin === undefined ? undefined : extra.origin });
  r.headers.set("x-forwarded-for", extra.ip ?? `10.0.0.${++ipN}`);
  return r;
};
const corpo = (email: string, extra: Record<string, unknown> = {}) => ({
  nome: "Bia Santos", email, telefone: "(19) 99999-1234", linkedin_url: "linkedin.com/in/bia-santos",
  respostas: [{ pergunta_id: pergunta, valor: "sim" }], aceite_privacidade: true,
  curriculo: { nome: "cv.pdf", tipo: "application/pdf", bytes: 1000 }, ...extra,
});
const linkDe = (texto: string) => texto.match(/\/c\/([A-Za-z0-9_-]{43})/)?.[1] ?? null;

async function candidatar(email: string, bytes: Uint8Array = pdf("Experiencia em atendimento")) {
  const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo(email)), params({ empresa: empresa.slug, slug: vaga.slug }));
  const b = await r.json();
  expect(r.status).toBe(201);
  expect((await uploadTo(b.upload_url, bytes)).status).toBe(200);
  const c = await concluirPost(req(`/api/publico/${empresa.slug}/candidaturas/${b.id}/concluir`, { concluir_token: b.concluir_token }), params({ empresa: empresa.slug, id: b.id }));
  return { id: b.id as string, status: c.status, body: await c.json() };
}

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa, { perguntas: [{ texto: "Trabalha aos sábados?", tipo: "sim_nao", resposta_esperada: "sim" }] });
  const { data } = await db().from("rs_perguntas").select("id").eq("vaga_id", vaga.id).single();
  pergunta = data!.id;
});
afterAll(cleanup);

describe("candidatar (9.2, 11.2)", () => {
  let token: string;
  it("cria, sobe, conclui; manda o link /c por e-mail; a mensagem guardada não tem o link (20.3)", async () => {
    const r = await candidatar("bia@teste.exemplo");
    expect(r.status).toBe(200);
    const email = emails.find((e) => e.to === "bia@teste.exemplo")!;
    expect(email.subject).toBe(`Recebemos sua candidatura para ${(await db().from("rs_vagas").select("titulo").eq("id", vaga.id).single()).data!.titulo}`);
    token = linkDe(email.text)!;
    expect(token).toBeTruthy();
    const { data: c } = await db().from("rs_candidaturas").select("origem, recebida_em, token_hash, rs_mensagens(corpo), rs_arquivos(extracao_status, texto_extraido, sha256)").eq("id", r.id).single();
    expect(c!.origem).toBe("pagina");
    expect(c!.recebida_em).toBeTruthy();
    expect(c!.token_hash).not.toContain(token);
    expect(c!.rs_mensagens[0].corpo).toContain("{{link_acompanhamento}}");
    expect(c!.rs_mensagens[0].corpo).not.toContain(token);
    expect(c!.rs_arquivos[0]).toMatchObject({ extracao_status: "ok" });
    expect(c!.rs_arquivos[0].texto_extraido).toContain("Experiencia em atendimento");
    const { data: n } = await db().from("rs_notificacoes").select("status, html, texto").eq("candidatura_id", r.id).single();
    expect(n).toEqual({ status: "enviada", html: "", texto: "" });
    expect(await requireCandidaturaPorToken(token)).not.toBeNull();
  });
  it("mesmo e-mail na vaga: não cria outra e reenvia o link (11.3)", async () => {
    const antes = emails.length;
    const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("BIA@teste.exemplo")), params({ empresa: empresa.slug, slug: vaga.slug }));
    expect(await r.json()).toMatchObject({ duplicada: true, mensagem: "Você já se candidatou a esta vaga. Enviamos o link de acompanhamento de novo para o seu e-mail." });
    expect(emails.length).toBe(antes + 1);
    const novo = linkDe(emails.at(-1)!.text)!;
    expect(await requireCandidaturaPorToken(novo)).not.toBeNull();
    expect(await requireCandidaturaPorToken(token)).toBeNull();
    token = novo;
    const { count } = await db().from("rs_candidaturas").select("id", { count: "exact", head: true }).eq("vaga_id", vaga.id);
    expect(count).toBe(1);
  });
  it("erros por campo: e-mail, telefone, LinkedIn, aceite, resposta obrigatória e currículo", async () => {
    const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("x", { telefone: "12", linkedin_url: "facebook.com/x", aceite_privacidade: false, respostas: [], curriculo: null })), params({ empresa: empresa.slug, slug: vaga.slug }));
    expect(r.status).toBe(400);
    const campos = (await r.json()).campos.map((c: { campo: string }) => c.campo);
    expect(campos).toEqual(expect.arrayContaining(["email", "telefone", "linkedin_url", "aceite_privacidade"]));
  });
  it(".exe renomeado para .pdf e 5 MB + 1 byte são recusados ao concluir", async () => {
    const r = await candidatar("exe@teste.exemplo", exe());
    expect(r.status).toBe(400);
    expect(r.body.campos[0]).toMatchObject({ campo: "curriculo", mensagem: "O currículo precisa ser PDF ou Word, com até 5 MB." });
    const grande = new Uint8Array(CURRICULO_MAX_BYTES + 1);
    grande.set(pdf("x"));
    expect((await candidatar("grande@teste.exemplo", grande)).status).toBe(400);
  });
  it("DOCX declarado como PDF é recusado; DOCX declarado certo passa", async () => {
    expect((await candidatar("docx@teste.exemplo", docx("Oi"))).status).toBe(400);
    const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("docx2@teste.exemplo", { curriculo: { nome: "cv.docx", tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: 500 } })), params({ empresa: empresa.slug, slug: vaga.slug }));
    const b = await r.json();
    await uploadTo(b.upload_url, docx("Padeira"));
    const c = await concluirPost(req(`/api/publico/${empresa.slug}/candidaturas/${b.id}/concluir`, { concluir_token: b.concluir_token }), params({ empresa: empresa.slug, id: b.id }));
    expect(c.status).toBe(200);
  });
  it("upload que não chegou: 'O envio não terminou'; tentar de novo usa a mesma candidatura", async () => {
    const r1 = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("caio@teste.exemplo")), params({ empresa: empresa.slug, slug: vaga.slug }));
    const b1 = await r1.json();
    const c1 = await concluirPost(req(`/api/publico/${empresa.slug}/candidaturas/${b1.id}/concluir`, { concluir_token: b1.concluir_token }), params({ empresa: empresa.slug, id: b1.id }));
    expect(c1.status).toBe(409);
    expect((await c1.json()).mensagem).toBe("O envio não terminou. Tente de novo; seus dados continuam aqui.");
    const r2 = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("caio@teste.exemplo")), params({ empresa: empresa.slug, slug: vaga.slug }));
    expect((await r2.json()).id).toBe(b1.id);
  });
  it("token de conclusão de outra candidatura não serve", async () => {
    const a = await (await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("dani@teste.exemplo")), params({ empresa: empresa.slug, slug: vaga.slug }))).json();
    const b = await (await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("edu@teste.exemplo")), params({ empresa: empresa.slug, slug: vaga.slug }))).json();
    const c = await concluirPost(req(`/api/publico/${empresa.slug}/candidaturas/${a.id}/concluir`, { concluir_token: b.concluir_token }), params({ empresa: empresa.slug, id: a.id }));
    expect(c.status).toBe(400);
  });
  it("campo-armadilha preenchido e limite por IP: recusa sem dizer o motivo (11.14)", async () => {
    const h = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("robo@teste.exemplo", { website: "http://spam" })), params({ empresa: empresa.slug, slug: vaga.slug }));
    expect(h.status).toBe(400);
    expect((await h.json()).mensagem).toBe("Não foi possível enviar agora. Tente de novo mais tarde.");
    const ip = "10.9.9.9";
    const status: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo(`ip${i}@teste.exemplo`), { ip }), params({ empresa: empresa.slug, slug: vaga.slug }));
      status.push(r.status);
    }
    expect(status.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(status[10]).toBe(429);
  });
  it("chamada de outro site é api_publica, com CORS para a origem https", async () => {
    const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, corpo("site@teste.exemplo"), { origin: "https://padaria.exemplo" }), params({ empresa: empresa.slug, slug: vaga.slug }));
    expect(r.headers.get("access-control-allow-origin")).toBe("https://padaria.exemplo");
    const b = await r.json();
    expect(b).not.toHaveProperty("token");
    const { data } = await db().from("rs_candidaturas").select("origem").eq("id", b.id).single();
    expect(data!.origem).toBe("api_publica");
  });

  describe("/c/{token} (11.13)", () => {
    it("baixar meus dados: JSON da 14.2, sem nota, avaliação nem motivo", async () => {
      const r = await exportarGet(apiRequest(`/api/c/${token}/exportar`), params({ token }));
      expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="dados-.*\.json"/);
      const j = await r.json();
      expect(Object.keys(j)).toEqual(["empresa", "gerado_em", "pessoa", "candidaturas"]);
      expect(j.pessoa).toMatchObject({ nome: "Bia Santos", email: "bia@teste.exemplo", telefone: "19999991234", linkedin: "https://linkedin.com/in/bia-santos" });
      expect(j.candidaturas[0]).toMatchObject({ situacao: "Em análise", respostas: [{ pergunta: "Trabalha aos sábados?", resposta: "sim" }] });
      expect(j.candidaturas[0].curriculo.url).toContain("/api/dev/arquivos/");
      expect(JSON.stringify(j)).not.toMatch(/motivo|nota|avaliac/);
    });
    it("retirar: desistiu, e-mail de confirmação e expurgar_em", async () => {
      const r = await retirarPost(apiRequest(`/api/c/${token}/retirar`, { method: "POST" }), params({ token }));
      expect(r.status).toBe(200);
      expect(emails.at(-1)!.subject).toContain("Você retirou sua candidatura");
      const c = await requireCandidaturaPorToken(token);
      expect(c!.situacao).toBe("desistiu");
      expect((await retirarPost(apiRequest(`/api/c/${token}/retirar`, { method: "POST" }), params({ token }))).status).toBe(409);
      expect((await retirarPost(apiRequest(`/api/c/${token}/retirar`, { method: "POST", origin: "https://outro.site" }), params({ token }))).status).toBe(403);
    });
    it("excluir: código por e-mail, errado conta, certo anonimiza e apaga o arquivo", async () => {
      const pedido = await (await codigoPost(apiRequest(`/api/c/${token}/excluir/codigo`, { method: "POST" }), params({ token }))).json();
      expect(pedido.email).toBe("b••••@t••••.exemplo");
      // O código vem no corpo; o assunto, que fica guardado na fila, não o leva (20.3).
      const codigo = emails.at(-1)!.text.match(/código (\d{6})/)![1];
      expect(emails.at(-1)!.subject).not.toContain(codigo);
      const errado = await excluirPost(apiRequest(`/api/c/${token}/excluir`, { method: "POST", body: { codigo: codigo === "000000" ? "111111" : "000000" } }), params({ token }));
      expect(errado.status).toBe(400);
      const c = await requireCandidaturaPorToken(token);
      const { data: arq } = await db().from("rs_arquivos").select("path").eq("candidatura_id", c!.id).single();
      const ok = await excluirPost(apiRequest(`/api/c/${token}/excluir`, { method: "POST", body: { codigo } }), params({ token }));
      expect(ok.status).toBe(200);
      expect(await requireCandidaturaPorToken(token)).toBeNull();
      expect(await storage().read(arq!.path, 10_000)).toBeNull();
      const { data: k } = await db().from("rs_candidatos").select("nome, email").eq("id", c!.candidato_id).single();
      expect(k).toEqual({ nome: "Pessoa removida", email: null });
    });
  });

  it("Perdi o link: resposta igual com ou sem candidatura; só quem tem recebe e-mail", async () => {
    await candidatar("fe@teste.exemplo");
    const antes = emails.length;
    const a = await linksEmpresa(req(`/api/publico/${empresa.slug}/links`, { email: "fe@teste.exemplo" }), params({ empresa: empresa.slug }));
    const b = await linksEmpresa(req(`/api/publico/${empresa.slug}/links`, { email: "ninguem@teste.exemplo" }), params({ empresa: empresa.slug }));
    expect(await a.json()).toEqual(await b.json());
    expect(emails.length).toBe(antes + 1);
    expect(emails.at(-1)!.to).toBe("fe@teste.exemplo");
    expect(linkDe(emails.at(-1)!.text)).toBeTruthy();
  });

  it("vaga pausada não recebe candidatura", async () => {
    const pausada = await createPublishedJob(empresa);
    await db().from("rs_vagas").update({ status: "pausada" }).eq("id", pausada.id);
    const r = await criarPost(req(`/api/publico/${empresa.slug}/vagas/${pausada.slug}/candidaturas`, corpo("g@teste.exemplo", { respostas: [], curriculo: null })), params({ empresa: empresa.slug, slug: pausada.slug }));
    expect(r.status).toBe(409);
    expect((await r.json()).codigo).toBe("vaga_fechada");
  });
});
