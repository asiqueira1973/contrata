// Achados do primeiro uso real (23/11/2026, instância oficial): (1) contratar e encerrar a vaga no
// mesmo pedido: um formulário só, com o aviso de quantas pessoas recebem a devolutiva sem contar
// quem está sendo contratado, e contratar antes de encerrar; (2) o nome do Google em maiúsculas
// chegava assim ao e-mail ({{recrutador}}); (3) o formulário de propostas era confundido com
// proposta de emprego; (4) a devolutiva prometia banco de talentos a quem não autorizou.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { nomeLegivel } from "@/lib/nome";
import { tokenDoLink } from "@/server/messages/link";
import { withdraw } from "@/server/recruiting/applications";
import { COM_UI, callTool, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestCompany, createTestToken, createTestUser, listTools } from "../../../tests/helpers";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let token: string;
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;
const situacao = async (id: string) => (await db().from("rs_candidaturas").select("situacao").eq("id", id).single()).data!.situacao;
type Item = { tipo: string; _aviso?: string; texto: string; candidatura?: string; vaga?: string; assunto?: string; motivo_encerramento?: string };

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  token = await createTestToken(empresa.id, empresa.adminMembroId);
});
afterAll(cleanup);

describe("contratar e encerrar a vaga no mesmo pedido", () => {
  it("um formulário só, com contratar e encerrar; o aviso não conta quem está sendo contratado", async () => {
    const vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
    const ana = await createReceivedApplication(empresa.id, vaga.id, { nome: "Ana Contratada", email: "ana@uso.exemplo" });
    await createReceivedApplication(empresa.id, vaga.id, { nome: "Rui Andamento", email: "rui@uso.exemplo" });
    const f = estrutura(await callTool(token, "abrir_formulario_decisoes", { acao: "contratar", candidaturas: [ana], encerrar_vaga: true }));
    const itens = (f.valores as { itens: Item[] }).itens;
    expect(itens.map((i) => i.tipo)).toEqual(["contratar", "encerrar_vaga"]);
    expect(itens[1]._aviso).toBe("1 pessoa em andamento vai receber esta mensagem.");
  });

  it("salvar contrata antes de encerrar, mesmo que o encerrar venha primeiro: quem foi contratado não recebe a devolutiva", async () => {
    const vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
    const bia = await createReceivedApplication(empresa.id, vaga.id, { nome: "Bia Contratada", email: "bia@uso.exemplo" });
    const leo = await createReceivedApplication(empresa.id, vaga.id, { nome: "Leo Andamento", email: "leo@uso.exemplo" });
    const r = estrutura(await callTool(token, "salvar_decisoes", { itens: [
      { tipo: "encerrar_vaga", vaga: vaga.id, motivo_encerramento: "preenchida", assunto: "Sobre sua candidatura", texto: "A vaga foi preenchida. Obrigado por ter participado do processo." },
      { tipo: "contratar", candidatura: bia, assunto: "Sobre sua candidatura", texto: "Queremos seguir com você na vaga." },
    ] }));
    expect(r.ok).toBe(true);
    expect(await situacao(bia)).toBe("contratada");
    expect(await situacao(leo)).toBe("encerrada_vaga");
    expect(emails.some((m) => m.to === "bia@uso.exemplo" && m.text.includes("foi preenchida"))).toBe(false);
  });

  it("se a contratação falha, o encerramento da mesma vaga no mesmo clique não acontece", async () => {
    const vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
    const cid = await createReceivedApplication(empresa.id, vaga.id, { nome: "Cid Falha", email: "cid@uso.exemplo" });
    const gil = await createReceivedApplication(empresa.id, vaga.id, { nome: "Gil Andamento", email: "gil@uso.exemplo" });
    await withdraw(tokenDoLink(cid, 0));
    const r = estrutura(await callTool(token, "salvar_decisoes", { itens: [
      { tipo: "contratar", candidatura: cid, assunto: "Sobre", texto: "Queremos seguir com você na vaga." },
      { tipo: "encerrar_vaga", vaga: vaga.id, motivo_encerramento: "preenchida", assunto: "Sobre sua candidatura", texto: "A vaga foi preenchida. Obrigado por ter participado do processo." },
    ] }));
    expect(r.ok).toBe(false);
    expect(await situacao(gil)).toBe("ativa");
  });
});

describe("nome em maiúsculas vindo do Google", () => {
  it("nomeLegivel arruma só o que veio todo em maiúsculas ou minúsculas", () => {
    expect(nomeLegivel("ALEXANDRE SIQUEIRA")).toBe("Alexandre Siqueira");
    expect(nomeLegivel("maria da silva dos santos")).toBe("Maria da Silva dos Santos");
    expect(nomeLegivel("JOÃO DE ÁVILA E SOUZA")).toBe("João de Ávila e Souza");
    expect(nomeLegivel("Ana McDonald")).toBe("Ana McDonald");
  });
  it("{{recrutador}} sai legível no texto ao candidato", async () => {
    const vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
    const ivo = await createReceivedApplication(empresa.id, vaga.id, { nome: "Ivo Nome", email: "ivo@uso.exemplo" });
    await db().from("rs_pessoas").update({ nome: "CARLA DE OLIVEIRA" }).eq("empresa_id", empresa.id).eq("membro_id", empresa.adminMembroId);
    const f = estrutura(await callTool(token, "abrir_formulario_decisoes", { acao: "contratar", candidaturas: [ivo] }));
    const texto = (f.valores as { itens: Item[] }).itens[0].texto;
    expect(texto).toContain("Carla de Oliveira");
    expect(texto).not.toContain("CARLA");
  });
});

describe("propostas de decisão não são proposta de emprego", () => {
  it("o título e a descrição das ferramentas de propostas dizem que são decisões, não oferta de emprego", async () => {
    const tools = await listTools(token, COM_UI);
    for (const nome of ["abrir_formulario_propostas", "listar_propostas"]) {
      const t = tools.find((x) => x.name === nome) as { title?: string; description?: string } | undefined;
      expect(t?.title, nome).toMatch(/decis(ã|a)o/i);
      expect(t?.description, nome).toMatch(/n(ã|a)o (é|e) (uma )?proposta de emprego/i);
    }
  });
});

describe("devolutiva e banco de talentos (11.12, 20)", () => {
  it("a mensagem não pode dizer que a pessoa fica no banco de talentos se ela não autorizou", async () => {
    const vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
    const sem = await createReceivedApplication(empresa.id, vaga.id, { nome: "Sem Consentimento", email: "sem@uso.exemplo" });
    const r = estrutura(await callTool(token, "salvar_decisoes", { itens: [
      { tipo: "reprovar", candidatura: sem, motivo: "experiencia", assunto: "Sobre", texto: "Obrigado pelo interesse. Seu cadastro fica no nosso banco de talentos para outras vagas." },
    ] }));
    expect(r.ok).toBe(false);
    expect((r.erros as { codigo: string }[])[0].codigo).toBe("talentos_sem_consentimento");
    expect(await situacao(sem)).toBe("ativa");
  });

  it("com o consentimento válido, a mesma frase passa", async () => {
    const vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
    const com = await createReceivedApplication(empresa.id, vaga.id, { nome: "Com Consentimento", email: "com@uso.exemplo" });
    const { data: c } = await db().from("rs_candidaturas").select("candidato_id").eq("id", com).single();
    await db().from("rs_candidatos").update({ talentos_consentido_em: new Date().toISOString(), talentos_expira_em: new Date(Date.now() + 90 * 86_400_000).toISOString() }).eq("id", c!.candidato_id);
    const r = estrutura(await callTool(token, "salvar_decisoes", { itens: [
      { tipo: "reprovar", candidatura: com, motivo: "experiencia", assunto: "Sobre", texto: "Obrigado pelo interesse. Seu cadastro fica no nosso banco de talentos para outras vagas." },
    ] }));
    expect(r.ok).toBe(true);
    expect(await situacao(com)).toBe("reprovada");
  });
});
