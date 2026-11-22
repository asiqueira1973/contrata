// Empresa pelo conector (épico 8.9; 7.4, 11.12, 11.20, 15.5): o formulário grava e recusa cor sem
// contraste, site sem https e faixas fora; só administrador; logo PNG aceito e servido com nosniff,
// SVG limpo, inválido e grande recusados; sem formulário, logo e "direto" recusados; texto extra do
// aviso guardado com a versão e devolvido no JSON do titular; exclusão com candidatura em andamento
// e com slug errado recusadas; excluída: página fora, chave de API e recrutador param, administrador
// só desfaz; desfazer volta tudo; trilha.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as empresaGet } from "@/app/api/v1/empresa/route";
import { GET as logoGet } from "@/app/api/publico/[empresa]/logo/route";
import { POST as candidatarPost } from "@/app/api/publico/[empresa]/vagas/[slug]/candidaturas/route";
import { POST as concluirPost } from "@/app/api/publico/[empresa]/candidaturas/[id]/concluir/route";
import { requireEmpresaPublica } from "@/server/careers/public";
import { db } from "@/server/db/client";
import { storage } from "@/server/files/storage";
import { tokenDoLink } from "@/server/messages/link";
import { exportData, withdraw } from "@/server/recruiting/applications";
import {
  SEM_UI, addMember, apiRequest, callTool, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestApiKey, createTestCompany,
  createTestToken, createTestUser, listTools, mcpRpc, params,
} from "../../../tests/helpers";

const emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string };
const tokens: Record<string, string> = {};
let chave = "";
const estrutura = (r: Awaited<ReturnType<typeof callTool>>) => ("structuredContent" in r ? r.structuredContent : undefined) as Record<string, unknown>;
const texto = (r: Awaited<ReturnType<typeof callTool>>) => ("content" in r ? r.content.map((c) => c.text).join(" ") : "");
const campos = (r: Awaited<ReturnType<typeof callTool>>) => ((estrutura(r)?.erros ?? []) as { campo: string | null; mensagem: string }[]);
const b64 = (b: Uint8Array | string) => Buffer.from(b).toString("base64");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const api = (path: string) => {
  const r = apiRequest(path, { origin: null });
  r.headers.set("authorization", `Bearer ${chave}`);
  return r;
};

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false });
  tokens.admin = await createTestToken(empresa.id, empresa.adminMembroId);
  tokens.recrutador = await createTestToken(empresa.id, await addMember(empresa, await createTestUser(), "recrutador"));
  chave = await createTestApiKey(empresa.id, empresa.adminMembroId, ["leitura"]);
});
afterAll(cleanup);

describe("formulário empresa (8.9; 11.20)", () => {
  it("só administrador; grava e mostra em quem_sou_eu e na API", async () => {
    expect((await listTools(tokens.recrutador)).map((t) => t.name)).not.toContain("abrir_formulario_empresa");
    const r = await callTool(tokens.admin, "salvar_empresa", { descricao: "Pão quente desde 1998.", cor_destaque: "#0B5CAD", retencao_dias: "120", site_url: "https://padaria.dev" });
    expect(estrutura(r).ok).toBe(true);
    expect(texto(r)).toMatch(/^Empresa atualizada: .*descrição.*cor.*retenção/);
    const eu = estrutura(await callTool(tokens.admin, "quem_sou_eu")).empresa as Record<string, unknown>;
    expect(eu).toMatchObject({ descricao: "Pão quente desde 1998.", cor_destaque: "#0b5cad", retencao_dias: 120 });
    const v1 = await (await empresaGet(api("/api/v1/empresa"))).json();
    expect(v1.empresa).toMatchObject({ retencao_dias: 120, site_url: "https://padaria.dev", mensagens_agente: "confirmar" });
  });
  it("recusa cor sem contraste com o branco, site sem https e faixas fora", async () => {
    const r = await callTool(tokens.admin, "salvar_empresa", { cor_destaque: "#ffd60a", site_url: "http://padaria.dev", retencao_dias: "30", talentos_meses: "30" });
    expect(estrutura(r).ok).toBe(false);
    expect(campos(r).map((e) => e.campo).sort()).toEqual(["cor_destaque", "retencao_dias", "site_url", "talentos_meses"]);
    expect(campos(r).find((e) => e.campo === "cor_destaque")!.mensagem).toMatch(/4,5:1/);
  });
  it("logo PNG aceito e servido com nosniff; trocar por SVG limpa o script e apaga o antigo", async () => {
    expect(estrutura(await callTool(tokens.admin, "salvar_empresa", { logo: { nome: "logo.png", tipo: "image/png", base64: b64(PNG) } })).ok).toBe(true);
    const { data: e1 } = await db().from("rs_empresas").select("logo_path").eq("id", empresa.id).single();
    expect(e1!.logo_path).toMatch(new RegExp(`^${empresa.id}/logo-[0-9a-f]{8}\\.png$`));
    const res = await logoGet(new Request("http://x"), params({ empresa: empresa.slug }));
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="https://mal.dev"><rect width="10" height="10" fill="#0b5cad"/></a><use href="javascript:alert(3)"/></svg>`;
    expect(estrutura(await callTool(tokens.admin, "salvar_empresa", { logo: { nome: "logo.svg", tipo: "image/svg+xml", base64: b64(svg) } })).ok).toBe(true);
    const { data: e2 } = await db().from("rs_empresas").select("logo_path").eq("id", empresa.id).single();
    const guardado = new TextDecoder().decode((await storage().read(e2!.logo_path!, 2_000_000))!);
    expect(guardado).toMatch(/^<svg/);
    expect(guardado).toContain("<rect");
    expect(guardado).not.toMatch(/script|onload|javascript|mal\.dev/i);
    expect(await storage().read(e1!.logo_path!, 2_000_000)).toBeNull();
    const svgRes = await logoGet(new Request("http://x"), params({ empresa: empresa.slug }));
    expect(svgRes.headers.get("content-security-policy")).toContain("default-src 'none'");
  });
  it("recusa logo que não é imagem, SVG que só tem script e arquivo acima de 1 MB", async () => {
    for (const [arq, codigo] of [
      [b64("não sou imagem"), "PNG, JPG ou SVG"],
      [b64("<svg><script>alert(1)</script></svg>"), "PNG, JPG ou SVG"],
      [b64(new Uint8Array(1024 * 1024 + 10).fill(0x89)), "1 MB"],
    ] as const) {
      const r = await callTool(tokens.admin, "salvar_empresa", { logo: { nome: "x", tipo: "image/png", base64: arq } });
      expect(estrutura(r).ok).toBe(false);
      expect(campos(r)[0]).toMatchObject({ campo: "logo" });
      expect(campos(r)[0].mensagem).toContain(codigo);
    }
  });
  it("sem formulário: logo e mensagens diretas recusados; o resto vai pela prévia", async () => {
    expect(JSON.stringify(await callTool(tokens.admin, "registrar_empresa", { logo: { nome: "l.png", tipo: "image/png", base64: b64(PNG) } }, SEM_UI))).toContain("so_no_formulario");
    expect(JSON.stringify(await callTool(tokens.admin, "registrar_empresa", { mensagens_agente: "direto" }, SEM_UI))).toContain("so_no_formulario");
    expect(estrutura(await callTool(tokens.admin, "registrar_empresa", { descricao: "Outra descrição." }, SEM_UI)).token_previa).toBeTruthy();
  });
});

describe("achados do verifier (8.9)", () => {
  it("A1: SVG de verdade mantém viewBox, gradiente e recorte", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0b5cad"/></linearGradient><clipPath id="c"><rect width="10" height="10"/></clipPath></defs><path d="M0 0h10v10z" fill="url(#g)" clip-path="url(#c)"/></svg>`;
    expect(estrutura(await callTool(tokens.admin, "salvar_empresa", { logo: { nome: "logo.svg", tipo: "image/svg+xml", base64: b64(svg) } })).ok).toBe(true);
    const { data } = await db().from("rs_empresas").select("logo_path").eq("id", empresa.id).single();
    const guardado = new TextDecoder().decode((await storage().read(data!.logo_path!, 2_000_000))!);
    expect(guardado).toContain('viewBox="0 0 1000 300"');
    expect(guardado).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(guardado).toContain("<linearGradient");
    expect(guardado).toContain('gradientUnits="userSpaceOnUse"');
    expect(guardado).toContain("<clipPath");
  });
  it("A3: logo inválido não deixa gravar o resto pela metade", async () => {
    const antes = (estrutura(await callTool(tokens.admin, "quem_sou_eu")).empresa as { cor_destaque: string }).cor_destaque;
    const r = await callTool(tokens.admin, "salvar_empresa", { cor_destaque: "#1d1d1f", logo: { nome: "x", tipo: "image/png", base64: b64("não sou imagem") } });
    expect(estrutura(r).ok).toBe(false);
    expect((estrutura(await callTool(tokens.admin, "quem_sou_eu")).empresa as { cor_destaque: string }).cor_destaque).toBe(antes);
  });
  it("A5: contraste logo abaixo de 4,5:1 não passa pelo arredondamento", async () => {
    const r = await callTool(tokens.admin, "salvar_empresa", { cor_destaque: "#007fb1" });
    expect(campos(r).map((e) => e.campo)).toEqual(["cor_destaque"]);
  });
  it("A6: texto extra só com quebras de linha conta como vazio", async () => {
    expect(estrutura(await callTool(tokens.admin, "salvar_empresa", { aviso_privacidade_extra: "\n\n" })).ok).toBe(true);
  });
});

describe("aviso de privacidade (15.5)", () => {
  it("texto extra: versão nova na candidatura, texto guardado e devolvido no JSON do titular", async () => {
    expect(estrutura(await callTool(tokens.admin, "salvar_empresa", { aviso_privacidade_extra: "Também guardamos para vagas da mesma área." })).ok).toBe(true);
    const { data: av } = await db().from("rs_avisos_privacidade").select("versao, texto_extra").eq("empresa_id", empresa.id).single();
    expect(av!.versao).toMatch(/^2026-11-20\+[0-9a-f]{8}$/);
    const req = apiRequest(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, { method: "POST", body: { nome: "Ana Aviso", email: "ana@aviso.exemplo", aceite_privacidade: true } });
    req.headers.set("x-forwarded-for", "10.9.0.1");
    const b = await (await candidatarPost(req, params({ empresa: empresa.slug, slug: vaga.slug }))).json();
    await concluirPost(apiRequest("/x", { method: "POST", body: { concluir_token: b.concluir_token } }), params({ empresa: empresa.slug, id: b.id }));
    const { data: c } = await db().from("rs_candidaturas").select("consentimento_versao").eq("id", b.id).single();
    expect(c!.consentimento_versao).toBe(av!.versao);
    const dados = await exportData(tokenDoLink(b.id, 0));
    expect(dados.conteudo.candidaturas[0].aviso_de_privacidade).toEqual({ versao: av!.versao, texto_extra: "Também guardamos para vagas da mesma área." });
    await withdraw(tokenDoLink(b.id, 0));
  });
});

describe("excluir e desfazer (7.4)", () => {
  it("recusa com candidatura em andamento e com o endereço errado; não tem fallback", async () => {
    const ativa = await createReceivedApplication(empresa.id, vaga.id, { nome: "Bia Ativa", email: "bia@ativa.exemplo" });
    expect((await listTools(tokens.admin, SEM_UI)).map((t) => t.name)).not.toContain("registrar_excluir_empresa");
    const r1 = await callTool(tokens.admin, "salvar_excluir_empresa", { confirmacao: empresa.slug });
    expect(estrutura(r1).ok).toBe(false);
    expect(JSON.stringify(r1)).toContain("candidaturas em andamento");
    await withdraw(tokenDoLink(ativa, 0));
    const r2 = await callTool(tokens.admin, "salvar_excluir_empresa", { confirmacao: "outra-coisa" });
    expect(campos(r2)[0]).toMatchObject({ campo: "confirmacao" });
  });
  it("exclui: e-mail aos administradores, página fora, chave e recrutador param, administrador só desfaz", async () => {
    await db().from("rs_empresas").update({ pagina_publicada: true }).eq("id", empresa.id);
    const antes = emails.length;
    const r = await callTool(tokens.admin, "salvar_excluir_empresa", { confirmacao: empresa.slug });
    expect(estrutura(r).ok).toBe(true);
    expect(texto(r)).toMatch(/Os dados serão apagados em \d{2}\/\d{2}\/\d{4}/);
    const e = emails.slice(antes).find((x) => x.subject.includes("será excluída"))!;
    expect(e.text).toContain("desfazer a exclusão da empresa");
    expect(await requireEmpresaPublica(empresa.slug)).toBeNull();
    expect((await empresaGet(api("/api/v1/empresa"))).status).toBe(401);
    expect((await mcpRpc(tokens.recrutador, "tools/list")).status).toBe(401);
    const nomes = (await listTools(tokens.admin)).map((t) => t.name).filter((n) => !n.startsWith("opcoes_")).sort();
    expect(nomes).toEqual(["abrir_formulario_desfazer_exclusao", "quem_sou_eu", "salvar_desfazer_exclusao"]);
    const eu = estrutura(await callTool(tokens.admin, "quem_sou_eu")).empresa as Record<string, unknown>;
    expect(eu.expurgar_em).toBeTruthy();
  });
  it("desfazer volta tudo; a trilha tem as três ações", async () => {
    const r = await callTool(tokens.admin, "salvar_desfazer_exclusao", {});
    expect(estrutura(r).ok).toBe(true);
    expect((await empresaGet(api("/api/v1/empresa"))).status).toBe(200);
    expect(await requireEmpresaPublica(empresa.slug)).not.toBeNull();
    expect((await listTools(tokens.recrutador)).length).toBeGreaterThan(5);
    const { data } = await db().from("rs_eventos").select("tipo, dados").eq("empresa_id", empresa.id).in("tipo", ["empresa_editada", "empresa_excluida", "exclusao_desfeita"]);
    expect(new Set((data ?? []).map((x) => x.tipo))).toEqual(new Set(["empresa_editada", "empresa_excluida", "exclusao_desfeita"]));
    expect(JSON.stringify(data)).not.toContain("Pão quente");
  });
});
