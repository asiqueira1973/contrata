// Parte pública das vagas (8.3): JSON-LD JobPosting (11.20 e os ajustes do 8.1), feed (14.3),
// API pública (13.2), sitemap e robots (17), pré-visualização assinada, markdown seguro (20.3) e a
// faxina das vagas vencidas (11.11). As páginas em si são conferidas no navegador.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "@/server/db/client";
import { GET as feedGet } from "@/app/[empresa]/vagas.xml/route";
import { GET as apiLista } from "@/app/api/publico/[empresa]/vagas/route";
import { GET as apiVaga } from "@/app/api/publico/[empresa]/vagas/[slug]/route";
import { GET as sitemapGet } from "@/app/sitemap.xml/route";
import { GET as cronGet } from "@/app/api/cron/diario/route";
import robots from "@/app/robots";
import { jobPosting } from "./jsonld";
import { markdownSeguro } from "./markdown";
import { previaValida, tokenDePrevia } from "./preview";
import { empresaPorSlug, vagaPublica, type VagaPublica } from "./public";
import { apiRequest, cleanup, createArea, createTestCompany, createTestUser, params } from "../../../tests/helpers";

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
const ids: Record<string, string> = {};
const ator = () => ({ tipo: "membro", membro_id: empresa.adminMembroId });
const ETAPAS = [{ nome: "Triagem", tipo: "triagem" }];
const DESC = "Atender no balcão, montar a vitrine e apoiar o caixa. <script>alert(1)</script> [site](https://x.exemplo)";

async function vaga(dados: Record<string, unknown>, status: "publicada" | "pausada" | "rascunho") {
  const { data, error } = await db().rpc("rs_fn_cria_vaga", { p_empresa: empresa.id, p_dados: { etapas: ETAPAS, descricao: DESC, ...dados } as never, p_alcance: { tipo: "todas" } as never, p_ator: ator(), p_chave: null as unknown as string });
  if (error) throw error;
  const id = (data as { id: string }).id;
  const muda = (para: string) => db().rpc("rs_fn_transicao_vaga", { p_vaga: id, p_empresa: empresa.id, p_para: para as never, p_motivo: null as never, p_alcance: { tipo: "todas" } as never, p_ator: ator(), p_max_publicadas: 50 });
  if (status !== "rascunho") await muda("publicada");
  if (status === "pausada") await muda("pausada");
  return id;
}

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  const loja = await createArea(empresa, "Loja");
  ids.presencial = await vaga({ titulo: "Atendente", area_id: loja, modelo_trabalho: "presencial", cidade: "Campinas", uf: "SP", regime: "clt", salario_min: 2800, salario_max: 3200, salario_periodo: "mes", mostrar_salario: true, encerra_em: "2099-12-31" }, "publicada");
  ids.remota = await vaga({ titulo: "Analista", modelo_trabalho: "remoto", regime: "pj", salario_min: 50, salario_periodo: "hora" }, "publicada");
  ids.pausada = await vaga({ titulo: "Auxiliar", modelo_trabalho: "remoto", regime: "estagio" }, "pausada");
  ids.rascunho = await vaga({ titulo: "Confeiteiro", modelo_trabalho: "remoto" }, "rascunho");
});
afterAll(cleanup);

// Campos obrigatórios e formatos do JobPosting (schema local, Google: job-posting).
const JobPostingLocal = z.object({
  "@context": z.literal("https://schema.org/"),
  "@type": z.literal("JobPosting"),
  title: z.string().min(1),
  description: z.string().min(1),
  datePosted: z.string().min(10),
  hiringOrganization: z.object({ "@type": z.literal("Organization"), name: z.string() }),
  identifier: z.object({ "@type": z.literal("PropertyValue"), name: z.string(), value: z.uuid() }),
  employmentType: z.enum(["FULL_TIME", "TEMPORARY", "INTERN", "CONTRACTOR", "OTHER"]),
  directApply: z.literal(true),
}).and(z.union([
  z.object({ jobLocation: z.object({ address: z.object({ addressLocality: z.string(), addressRegion: z.string(), addressCountry: z.literal("BR") }) }) }),
  z.object({ jobLocationType: z.literal("TELECOMMUTE"), applicantLocationRequirements: z.object({ "@type": z.literal("Country"), name: z.literal("BR") }) }),
]));

async function publica(id: string): Promise<VagaPublica> {
  const { data } = await db().from("rs_vagas").select("slug").eq("id", id).single();
  return (await vagaPublica(empresa.id, data!.slug))!;
}

describe("JSON-LD JobPosting (11.20)", () => {
  it("presencial com salário mensal e data-limite em BRT", async () => {
    const e = (await empresaPorSlug(empresa.slug))!;
    const v = await publica(ids.presencial);
    const ld = jobPosting(e, v, "https://x/vaga")!;
    expect(JobPostingLocal.safeParse(ld).success).toBe(true);
    expect(ld).toMatchObject({
      employmentType: "FULL_TIME",
      validThrough: "2099-12-31T23:59:59-03:00",
      baseSalary: { "@type": "MonetaryAmount", currency: "BRL", value: { "@type": "QuantitativeValue", minValue: 2800, maxValue: 3200, unitText: "MONTH" } },
      jobLocation: { "@type": "Place", address: { addressLocality: "Campinas", addressRegion: "SP", addressCountry: "BR" } },
    });
    expect(ld).not.toHaveProperty("jobLocationType");
  });
  it("remoto por hora, sem salário mostrado; PJ vira CONTRACTOR", async () => {
    const ld = jobPosting((await empresaPorSlug(empresa.slug))!, await publica(ids.remota), "https://x/vaga")!;
    expect(JobPostingLocal.safeParse(ld).success).toBe(true);
    expect(ld).toMatchObject({ jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "BR" }, employmentType: "CONTRACTOR" });
    expect(ld).not.toHaveProperty("baseSalary");
    expect(ld).not.toHaveProperty("validThrough");
  });
  it("vaga pausada: sem JSON-LD", async () => {
    expect(jobPosting((await empresaPorSlug(empresa.slug))!, await publica(ids.pausada), "https://x")).toBeNull();
  });
});

describe("markdown seguro (20.3)", () => {
  it("tira script e marca links de fora", () => {
    const html = markdownSeguro(DESC);
    expect(html).not.toContain("<script");
    expect(html).toContain('href="https://x.exemplo"');
    expect(html).toContain('rel="nofollow noopener"');
    expect(markdownSeguro("<img src=x onerror=alert(1)>")).not.toContain("onerror");
  });
});

describe("página não publicada: feed e API pública respondem 404", () => {
  it("sem pagina_publicada", async () => {
    expect((await feedGet(new Request("http://x"), params({ empresa: empresa.slug }))).status).toBe(404);
    expect((await apiLista(new Request("http://x"), params({ empresa: empresa.slug }))).status).toBe(404);
  });
});

describe("com a página publicada (critério do 8.3)", () => {
  beforeAll(async () => {
    await db().from("rs_empresas").update({ pagina_publicada: true }).eq("id", empresa.id);
  });
  it("feed lista só as publicadas, com salário só quando mostrado", async () => {
    const xml = await (await feedGet(new Request("http://x"), params({ empresa: empresa.slug }))).text();
    expect(xml).toContain("<title><![CDATA[Atendente]]></title>");
    expect(xml).toContain("<title><![CDATA[Analista]]></title>");
    expect(xml).not.toContain("Auxiliar");
    expect(xml).not.toContain("Confeiteiro");
    expect(xml).not.toContain("<script");
    expect(xml.match(/<salary>/g)).toHaveLength(1);
  });
  it("API pública: só publicadas, CORS aberto, nada interno", async () => {
    const r = await apiLista(new Request("http://x"), params({ empresa: empresa.slug }));
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    const body = await r.json();
    expect(body.vagas.map((v: { titulo: string }) => v.titulo).sort()).toEqual(["Analista", "Atendente"]);
    expect(Object.keys(body.vagas[0])).not.toEqual(expect.arrayContaining(["dono", "equipe", "status"]));
    const { data } = await db().from("rs_vagas").select("slug").eq("id", ids.pausada).single();
    expect((await apiVaga(new Request("http://x"), params({ empresa: empresa.slug, slug: data!.slug }))).status).toBe(404);
  });
  it("sitemap traz a página e as publicadas; robots bloqueia o que não se indexa", async () => {
    const xml = await (await sitemapGet()).text();
    expect(xml).toContain(`/${empresa.slug}</loc>`);
    expect(xml).toContain(`/${empresa.slug}/vagas/atendente</loc>`);
    expect(xml).not.toContain(`/${empresa.slug}/vagas/auxiliar`);
    const r = robots();
    expect(r.rules).toMatchObject({ disallow: expect.arrayContaining(["/c/", "/api/", "/oauth/", "/mcp", "/entrar", "/sair", "/convite/"]) });
  });
});

describe("pré-visualização assinada (8.3)", () => {
  it("vale 10 min, só para a empresa dela", () => {
    const agora = Date.now();
    const t = tokenDePrevia(empresa.id, agora);
    expect(previaValida(empresa.id, t, agora)).toBe(true);
    expect(previaValida(empresa.id, t, agora + 601_000)).toBe(false);
    expect(previaValida("00000000-0000-0000-0000-000000000000", t, agora)).toBe(false);
    expect(previaValida(empresa.id, `${t}x`, agora)).toBe(false);
    expect(previaValida(empresa.id, null, agora)).toBe(false);
  });
});

describe("faxina das vagas vencidas (11.11)", () => {
  it("sem CRON_SECRET: 401; com ele, pausa a vencida e é idempotente", async () => {
    expect((await cronGet(apiRequest("/api/cron/diario"))).status).toBe(401);
    await db().from("rs_vagas").update({ encerra_em: "2020-01-01" }).eq("id", ids.presencial);
    const req = () => {
      const r = apiRequest("/api/cron/diario");
      r.headers.set("authorization", `Bearer ${process.env.CRON_SECRET}`);
      return r;
    };
    const r1 = await (await cronGet(req())).json();
    expect(r1.vagas_pausadas).toBeGreaterThanOrEqual(1);
    const { data } = await db().from("rs_vagas").select("status").eq("id", ids.presencial).single();
    expect(data!.status).toBe("pausada");
    await cronGet(req());
    const { count } = await db().from("rs_eventos").select("id", { count: "exact", head: true }).eq("vaga_id", ids.presencial).eq("tipo", "vaga_pausada_prazo");
    expect(count).toBe(1);
  });
});
