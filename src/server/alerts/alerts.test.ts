// Alertas da instância ao ADMIN_EMAIL (6.1, 18, 23.1; v0.4.13) e o aviso de empresa sem espaço aos
// administradores dela (11.14). Com a caixa de saída em memória e o banco local.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { apiRequest, captureEmails, cleanup, createPublishedJob, createTestCompany, createTestUser, params } from "../../../tests/helpers";

// Um passo da faxina que falha, controlado por variável (não vi.fn; ver CLAUDE.md, Vitest 5.1.1).
let pausaFalha = false;
vi.mock("@/server/recruiting/jobs", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/server/recruiting/jobs")>();
  return { ...orig, pauseExpiredJobs: async (lote: number) => {
    if (pausaFalha) throw new Error("falha_simulada");
    return orig.pauseExpiredJobs(lote);
  } };
});
const { alertaBanco, alertaEmailEmUso, alertaFaxina } = await import("./instance");
const { runDailyCleanup } = await import("@/server/cron");
const { POST: candidatarPost } = await import("@/app/api/publico/[empresa]/vagas/[slug]/candidaturas/route");

const ENV = { ...process.env };
const ADMIN = "admin@instancia.exemplo";
const hoje = new Date();
const chavesCriadas: string[] = [];

async function alertas(prefixo: string) {
  const { data } = await db().from("rs_notificacoes").select("chave_idempotencia, destinatario, assunto, texto, empresa_id").like("chave_idempotencia", `${prefixo}%`);
  return data ?? [];
}
const PESSOAL = /@padaria|@teste\.dev|Pessoa Teste|Ana Cheia/;

beforeAll(async () => {
  // Alertas de outros dias ou rodadas não contam: apaga os de hoje antes.
  await db().from("rs_notificacoes").delete().like("chave_idempotencia", "alerta:%");
});
afterEach(() => {
  process.env = { ...ENV };
  pausaFalha = false;
});
afterAll(async () => {
  await db().from("rs_notificacoes").delete().like("chave_idempotencia", "alerta:%");
  if (chavesCriadas.length) await db().from("rs_usuarios").delete().in("google_sub", chavesCriadas);
  await cleanup();
});

describe("sem ADMIN_EMAIL", () => {
  it("nenhum alerta da instância entra na fila", async () => {
    delete process.env.ADMIN_EMAIL;
    process.env.ALERTA_BANCO_LIMITE_MB = "1";
    expect(await alertaFaxina([{ passo: "x", codigo: "y" }], hoje)).toBe(false);
    expect(await alertaBanco(hoje)).toBe(0);
    expect(await alertaEmailEmUso("sub", "qualquer@teste.dev", hoje)).toBe(false);
    expect(await alertas("alerta:")).toEqual([]);
  });
});

describe("login com e-mail em uso (6.1)", () => {
  it("um alerta por dia, só com ids, sem e-mail nem nome", async () => {
    process.env.ADMIN_EMAIL = ADMIN;
    const box = captureEmails();
    const dono = await createTestUser();
    const sub = `sub-${randomUUID()}`;
    chavesCriadas.push(sub);
    const { data: outro } = await db().from("rs_usuarios").insert({ google_sub: sub, email: `outro-${randomUUID().slice(0, 6)}@teste.dev`, nome: "Pessoa Teste" }).select("id").single();
    expect(await alertaEmailEmUso(sub, dono.email, hoje)).toBe(true);
    expect(await alertaEmailEmUso(sub, dono.email, hoje)).toBe(false);
    const [a, ...resto] = await alertas(`alerta:email_em_uso:${dono.id}`);
    expect(resto).toEqual([]);
    expect(a.destinatario).toBe(ADMIN);
    expect(a.empresa_id).toBeNull();
    expect(box.at(-1)!.text).toContain(dono.id);
    expect(box.at(-1)!.text).toContain(outro!.id);
    expect(box.at(-1)!.text).not.toContain(dono.email);
    expect(box.at(-1)!.text + box.at(-1)!.subject).not.toMatch(PESSOAL);
  });
});

describe("faxina (18)", () => {
  it("um passo que falha gera um alerta com o nome do passo e o código; o resto segue", async () => {
    process.env.ADMIN_EMAIL = ADMIN;
    const box = captureEmails();
    pausaFalha = true;
    const r = (await runDailyCleanup(undefined, hoje)) as unknown as Record<string, number> & { falharam: string[] };
    expect(r.falharam).toEqual(["vagas_pausadas"]);
    expect(r.alerta_faxina).toBe(1);
    const msg = box.find((m) => m.to === ADMIN && m.text.includes("vagas_pausadas"));
    expect(msg?.text).toContain("vagas_pausadas: falha_simulada");
    expect(r.convites_expirados).toBeTypeOf("number");
    // Mesma falha no mesmo dia: não manda de novo.
    expect(((await runDailyCleanup(undefined, hoje)) as unknown as Record<string, number>).alerta_faxina).toBe(0);
  });

  it("faxina sem falha não gera alerta", async () => {
    process.env.ADMIN_EMAIL = ADMIN;
    expect(await alertaFaxina([], hoje)).toBe(false);
    // Um dia em que ainda não houve alerta: a faxina inteira, sem falha, não manda nada.
    const outroDia = new Date(hoje.getTime() + 3 * 86_400_000);
    const r = (await runDailyCleanup(undefined, outroDia)) as unknown as Record<string, number> & { falharam: string[] };
    expect(r.falharam).toEqual([]);
    expect(r.alerta_faxina).toBe(0);
  });
});

describe("banco acima de 70% do plano (23.1)", () => {
  it("acima do limiar: um alerta por dia com tamanho e limite; abaixo: nada", async () => {
    process.env.ADMIN_EMAIL = ADMIN;
    const box = captureEmails();
    process.env.ALERTA_BANCO_LIMITE_MB = "100000000";
    expect(await alertaBanco(hoje)).toBe(0);
    process.env.ALERTA_BANCO_LIMITE_MB = "1";
    expect(await alertaBanco(hoje)).toBe(1);
    expect(await alertaBanco(hoje)).toBe(0);
    const m = box.find((x) => x.to === ADMIN && x.subject.includes("% do plano"));
    expect(m?.text).toMatch(/usa \d+ MB de 1 MB/);
  });
});

describe("empresa sem espaço (11.14)", () => {
  it("currículo recusado: aviso aos administradores da empresa, um por dia, e não ao candidato", async () => {
    const box = captureEmails();
    const dono = await createTestUser();
    const empresa = await createTestCompany(dono);
    const vaga = await createPublishedJob(empresa);
    // 6 GB de arquivos (três "logos" de 2 GB: a coluna é integer).
    await db().from("rs_arquivos").insert([1, 2, 3].map((i) => ({ empresa_id: empresa.id, tipo: "logo" as const, path: `${empresa.id}/cheio-${i}.png`, nome_original: "x.png", mime: "image/png", bytes: 2_000_000_000 })));
    const envia = async (ip: string) => {
      const req = apiRequest(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, {
        method: "POST",
        body: { nome: "Ana Cheia", email: `ana-${randomUUID().slice(0, 6)}@cheia.exemplo`, aceite_privacidade: true, curriculo: { nome: "cv.pdf", tipo: "application/pdf", bytes: 1000 } },
      });
      req.headers.set("x-forwarded-for", ip);
      return candidatarPost(req, params({ empresa: empresa.slug, slug: vaga.slug }));
    };
    const r1 = await envia("10.77.0.1");
    expect(r1.status).toBe(409);
    expect((await r1.json()).codigo).toBe("armazenamento_cheio");
    await envia("10.77.0.2");
    const avisos = box.filter((m) => m.subject.includes("sem espaço"));
    expect(avisos.map((m) => m.to)).toEqual([dono.email]);
    expect(avisos[0].text).toMatch(/5\.6 GB dos 5 GB/);
    expect(box.some((m) => m.to.includes("@cheia.exemplo"))).toBe(false);
    expect(avisos[0].text + avisos[0].subject).not.toMatch(/Ana Cheia|@cheia\.exemplo/);
    await db().from("rs_arquivos").delete().eq("empresa_id", empresa.id).like("path", "%/cheio-%");
  });
});
