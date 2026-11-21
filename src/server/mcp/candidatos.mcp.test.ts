// adicionar_candidato pelo conector (8.4; 11.2, 13.3): formulário com as vagas publicadas do
// alcance, inclusão com currículo (base64), origem manual e o e-mail "incluiu você", alcance do
// recrutador limitado, avaliador sem o formulário, e o fallback sem currículo.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import {
  COM_UI, SEM_UI, addMember, callTool, captureEmails, cleanup, createArea, createPublishedJob, createTestCompany, createTestToken, createTestUser, listTools,
} from "../../../tests/helpers";
import { exe, pdf } from "../../../tests/fixtures/curriculos";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vagaLoja: { id: string }, vagaFin: { id: string };
const tokens: Record<string, string> = {};
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;
const arquivo = (bytes: Uint8Array, nome = "cv.pdf", tipo = "application/pdf") => ({ nome, tipo, base64: Buffer.from(bytes).toString("base64") });

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  const loja = await createArea(empresa, "Loja");
  const fin = await createArea(empresa, "Financeiro");
  vagaLoja = await createPublishedJob(empresa, { area_id: loja });
  vagaFin = await createPublishedJob(empresa, { area_id: fin });
  const limitado = await addMember(empresa, await createTestUser(), "recrutador", [loja]);
  const aval = await addMember(empresa, await createTestUser(), "avaliador");
  tokens.admin = await createTestToken(empresa.id, empresa.adminMembroId);
  tokens.limitado = await createTestToken(empresa.id, limitado);
  tokens.avaliador = await createTestToken(empresa.id, aval);
  tokens.leitura = await createTestToken(empresa.id, empresa.adminMembroId, ["leitura"]);
});
afterAll(cleanup);

describe("adicionar_candidato (11.2, 13.3)", () => {
  it("o formulário traz só as vagas publicadas do alcance e o campo de arquivo", async () => {
    const f = estrutura(await callTool(tokens.limitado, "abrir_formulario_adicionar_candidato", { nome: "Ana Lima" })) as {
      valores: Record<string, unknown>; campos: { nome: string; tipo: string }[];
    };
    const o = estrutura(await callTool(tokens.limitado, "opcoes_adicionar_candidato", {})) as { opcoes: { vagas: { valor: string }[] } };
    expect(f.valores.nome).toBe("Ana Lima");
    expect(f.campos.find((c) => c.nome === "curriculo")?.tipo).toBe("arquivo");
    expect(o.opcoes.vagas.map((v) => v.valor)).toEqual([vagaLoja.id]);
  });
  it("inclui com currículo: recebida, origem manual, ator membro, e-mail 'incluiu você' com o link", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_adicionar_candidato", {
      vaga: vagaLoja.id, nome: "Ana Lima", email: "ana@teste.exemplo", telefone: "", linkedin_url: "", curriculo: arquivo(pdf("Vendas no varejo")),
    }));
    expect(r.ok).toBe(true);
    const id = (r.ids as string[])[0];
    const { data } = await db().from("rs_candidaturas").select("origem, recebida_em, consentimento_versao, rs_arquivos(mime)").eq("id", id).single();
    expect(data).toMatchObject({ origem: "manual", consentimento_versao: "manual", rs_arquivos: [{ mime: "application/pdf" }] });
    expect(data!.recebida_em).toBeTruthy();
    const { data: ev } = await db().from("rs_eventos").select("origem, ator_tipo").eq("candidatura_id", id).eq("tipo", "candidatura_criada").single();
    expect(ev).toEqual({ origem: "formulario", ator_tipo: "membro" });
    const email = emails.find((e) => e.to === "ana@teste.exemplo")!;
    expect(email.text).toMatch(/\/c\/[A-Za-z0-9_-]{43}/);
  });
  it("arquivo que não é PDF nem Word é recusado no campo, sem gravar", async () => {
    const r = estrutura(await callTool(tokens.admin, "salvar_adicionar_candidato", {
      vaga: vagaLoja.id, nome: "Rui Costa", email: "rui@teste.exemplo", curriculo: arquivo(exe(), "cv.pdf"),
    }));
    expect(r.ok).toBe(false);
    expect((r.erros as { campo: string }[])[0].campo).toBe("curriculo");
    const { count } = await db().from("rs_candidatos").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("email", "rui@teste.exemplo");
    expect(count).toBe(0);
  });
  it("recrutador limitado não inclui em vaga fora do alcance", async () => {
    const r = estrutura(await callTool(tokens.limitado, "salvar_adicionar_candidato", { vaga: vagaFin.id, nome: "Lia Reis", email: "lia@teste.exemplo" }));
    expect(r.ok).toBe(false);
  });
  it("avaliador e token sem escrita não veem o formulário", async () => {
    for (const t of [tokens.avaliador, tokens.leitura]) {
      const nomes = (await listTools(t)).map((x) => x.name);
      expect(nomes).not.toContain("salvar_adicionar_candidato");
    }
  });
  it("fallback inclui sem currículo, com ator agente; com currículo é recusado", async () => {
    expect((await listTools(tokens.admin, SEM_UI)).map((x) => x.name)).toContain("registrar_adicionar_candidato");
    const args = { vaga: vagaLoja.id, nome: "Téo Alves", email: "teo@teste.exemplo" };
    const previa = estrutura(await callTool(tokens.admin, "registrar_adicionar_candidato", args, SEM_UI)) as { token_previa: string };
    const ok = estrutura(await callTool(tokens.admin, "registrar_adicionar_candidato", { ...args, confirmar: true, token_previa: previa.token_previa }, SEM_UI));
    expect(ok.ok).toBe(true);
    const { data: ev } = await db().from("rs_eventos").select("origem, ator_tipo").eq("candidatura_id", (ok.ids as string[])[0]).eq("tipo", "candidatura_criada").single();
    expect(ev).toEqual({ origem: "mcp", ator_tipo: "agente" });
    const comArquivo = await callTool(tokens.admin, "registrar_adicionar_candidato", { ...args, email: "teo2@teste.exemplo", curriculo: arquivo(pdf("x")) }, SEM_UI);
    expect(JSON.stringify(comArquivo)).toContain("so_no_formulario");
  });
  it("na interface, o formulário é o mesmo para todos os hosts com UI", async () => {
    expect((await listTools(tokens.admin, COM_UI)).map((x) => x.name)).toContain("abrir_formulario_adicionar_candidato");
  });
});
