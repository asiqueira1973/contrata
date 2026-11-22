// Faxina diária (épico 8.10): rota protegida por CRON_SECRET; duas rodadas no mesmo dia não
// duplicam e-mail; expurgo apaga os arquivos do bucket e guarda o currículo de quem está no banco de
// talentos; empresa excluída há 8 dias some com a pasta; e-mail que falha é retentado e descartado
// na 5ª; resumo diário só com contagens, ao responsável ou à equipe; resumo semanal só na segunda
// e só ao dono sem acesso, com "Pedir acesso"; sem tempo, o resto fica para amanhã no log.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as cronGet } from "@/app/api/cron/diario/route";
import { POST as pedirAcessoPost } from "@/app/api/publico/[empresa]/pedir-acesso/route";
import { runDailyCleanup } from "@/server/cron";
import { db } from "@/server/db/client";
import { setMailerForTests } from "@/server/email/mailer";
import { enqueue, retryNotifications } from "@/server/email/outbox";
import { storage } from "@/server/files/storage";
import { tokenDoLink } from "@/server/messages/link";
import { purgeCompanies, purgeExpired } from "@/server/org/cleanup";
import { withdraw } from "@/server/recruiting/applications";
import { dailyDigest, weeklyOwnerDigest } from "@/server/recruiting/digests";
import {
  apiRequest, captureEmails, cleanup, createPublishedJob, createReceivedApplication, createTestCompany, createTestUser, params, trackCompany,
} from "../../tests/helpers";

let emails = captureEmails();
let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let adminEmail = "";
let vaga: { id: string; slug: string };
let dono = "";
const SEGUNDA = new Date("2026-11-23T12:00:00-03:00");
const TERCA = new Date("2026-11-24T12:00:00-03:00");

// Candidatura recebida com currículo no bucket local. Devolve o id e o caminho.
async function comCurriculo(nome: string, email: string) {
  const id = await createReceivedApplication(empresa.id, vaga.id, { nome, email });
  const path = `${empresa.id}/${id}/curriculo.pdf`;
  await storage().write(path, new TextEncoder().encode("%PDF-1.4 teste"), "application/pdf");
  await db().from("rs_arquivos").insert({ empresa_id: empresa.id, candidatura_id: id, tipo: "curriculo", path, nome_original: "cv.pdf", mime: "application/pdf", bytes: 14, confirmado_em: new Date().toISOString() });
  return { id, path };
}
const candidatoDe = async (id: string) => (await db().from("rs_candidaturas").select("candidato_id").eq("id", id).single()).data!.candidato_id;

beforeAll(async () => {
  const admin = await createTestUser();
  adminEmail = admin.email;
  empresa = await createTestCompany(admin);
  const { data: p } = await db().rpc("rs_fn_salva_pessoa", {
    p_empresa: empresa.id, p_id: null as never, p_nome: "Dora Dona", p_email: "dora@faxina.exemplo", p_cargo: null as never, p_area: null as never,
    p_recebe_resumo: true, p_ator: { tipo: "membro", membro_id: empresa.adminMembroId } as never,
  });
  dono = p as string;
  vaga = await createPublishedJob(empresa, { curriculo_obrigatorio: false, dono_pessoa_id: dono });
});
afterAll(cleanup);

describe("rota do cron (8.10)", () => {
  it("401 sem o segredo; com ele, as contagens e nada sobrou", async () => {
    expect((await cronGet(apiRequest("/api/cron/diario", { origin: null }))).status).toBe(401);
    const req = apiRequest("/api/cron/diario", { origin: null });
    req.headers.set("authorization", `Bearer ${process.env.CRON_SECRET}`);
    const r = await (await cronGet(req)).json();
    expect(r.sobrou).toEqual([]);
    expect(Object.keys(r)).toEqual(expect.arrayContaining(["convites_expirados", "candidaturas_expurgadas", "resumos_diarios", "emails_retentados", "notificacoes_apagadas"]));
  });
  it("sem tempo, o resto fica para amanhã e vai no log", async () => {
    let t = 0;
    const r = await runDailyCleanup(() => (t += 60_000));
    expect(r.sobrou.length).toBeGreaterThan(5);
  });
});

describe("expurgo (11.12, 7.4)", () => {
  it("vencida: anonimiza e apaga o arquivo; com talentos válido guarda nome e currículo até vencer", async () => {
    const a = await comCurriculo("Ana Expurgo", "ana@expurgo.exemplo");
    const b = await comCurriculo("Bia Talento", "bia@expurgo.exemplo");
    await db().from("rs_candidatos").update({ talentos_consentido_em: new Date().toISOString(), talentos_expira_em: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq("id", await candidatoDe(b.id));
    await withdraw(tokenDoLink(a.id, 0));
    await withdraw(tokenDoLink(b.id, 0));
    await db().from("rs_candidaturas").update({ expurgar_em: new Date(Date.now() - 86_400_000).toISOString() }).in("id", [a.id, b.id]);
    const r = await purgeExpired(200);
    expect(r.candidaturas).toBeGreaterThanOrEqual(2);
    expect(await storage().read(a.path, 1000)).toBeNull();
    expect(await storage().read(b.path, 1000)).not.toBeNull();
    const { data: ka } = await db().from("rs_candidatos").select("nome, email").eq("id", await candidatoDe(a.id)).single();
    expect(ka).toEqual({ nome: "Pessoa removida", email: null });
    const { data: kb } = await db().from("rs_candidatos").select("nome").eq("id", await candidatoDe(b.id)).single();
    expect(kb!.nome).toBe("Bia Talento");
    await db().from("rs_candidatos").update({ talentos_expira_em: new Date(Date.now() - 60_000).toISOString() }).eq("id", await candidatoDe(b.id));
    await purgeExpired(200);
    expect(await storage().read(b.path, 1000)).toBeNull();
  });
  it("empresa excluída há 8 dias some com a pasta do bucket", async () => {
    const outra = await createTestCompany(await createTestUser());
    await storage().write(`${outra.id}/logo-aaaa1111.png`, new Uint8Array([1, 2, 3]), "image/png");
    await db().from("rs_empresas").update({ excluida_em: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq("id", outra.id);
    expect(await purgeCompanies(5)).toBeGreaterThanOrEqual(1);
    expect(await storage().read(`${outra.id}/logo-aaaa1111.png`, 1000)).toBeNull();
    const { count } = await db().from("rs_empresas").select("id", { count: "exact", head: true }).eq("id", outra.id);
    expect(count).toBe(0);
    trackCompany(empresa.id);
  });
});

describe("e-mails (12.4)", () => {
  it("o que falha é retentado com o remetente e descartado na 5ª falha", async () => {
    setMailerForTests({ async send() { throw new Error("resend_500"); } });
    const id = (await enqueue({ empresaId: empresa.id, tipo: "resumo_diario", destinatario: "x@faxina.exemplo", chave: `retenta:${Date.now()}`,
      assunto: "Assunto", html: "<p>x</p>", texto: "x", fromName: "Padaria" }))!;
    await new Promise((ok) => setTimeout(ok, 50));
    for (let i = 0; i < 6; i++) await retryNotifications(200, 10_000);
    const { data } = await db().from("rs_notificacoes").select("status, tentativas, html, remetente_nome").eq("id", id).single();
    expect(data).toEqual({ status: "descartada", tentativas: 5, html: "", remetente_nome: "Padaria" });
    emails = captureEmails();
  });
});

describe("achados do verifier (8.10)", () => {
  it("A3: arquivo que não sai do bucket fica anotado e sai na próxima rodada", async () => {
    const a = await comCurriculo("Gil Arquivo", "gil@arquivo.exemplo");
    await withdraw(tokenDoLink(a.id, 0));
    await db().from("rs_candidaturas").update({ expurgar_em: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", a.id);
    const s = storage();
    const original = s.delete.bind(s);
    s.delete = async () => {
      throw new Error("s3_falhou");
    };
    try {
      await purgeExpired(200);
    } finally {
      s.delete = original;
    }
    expect(await storage().read(a.path, 1000)).not.toBeNull();
    await purgeExpired(200);
    expect(await storage().read(a.path, 1000)).toBeNull();
  });
  it("A4: o resumo diário respeita o prazo", async () => {
    expect(await dailyDigest(TERCA, 0)).toBe(0);
  });
  it("A2: o resumo semanal passa por todas as vagas, não só o primeiro lote", async () => {
    const outra = await createPublishedJob(empresa, { curriculo_obrigatorio: false, dono_pessoa_id: dono });
    const titulo = (await db().from("rs_vagas").select("titulo").eq("id", outra.id).single()).data!.titulo;
    const antes = emails.length;
    await weeklyOwnerDigest(1, new Date("2026-11-30T12:00:00-03:00"));
    const assuntos = emails.slice(antes).filter((x) => x.to === "dora@faxina.exemplo").map((x) => x.subject);
    expect(assuntos.length).toBeGreaterThanOrEqual(2);
    expect(assuntos.some((a) => a.startsWith(titulo))).toBe(true);
  });
});

describe("resumos (11.11, 11.31)", () => {
  it("diário: só contagens por vaga, à equipe quando não há responsável, uma vez por dia", async () => {
    const c = await createReceivedApplication(empresa.id, vaga.id, { nome: "Caio Parado", email: "caio@parado.exemplo" });
    await db().from("rs_candidaturas").update({ movida_em: new Date(Date.now() - 20 * 86_400_000).toISOString() }).eq("id", c);
    const antes = emails.length;
    expect(await dailyDigest(TERCA)).toBeGreaterThanOrEqual(1);
    const e = emails.slice(antes).find((x) => x.to === adminEmail)!;
    expect(e.subject).toMatch(/(1 item precisa|itens precisam) de você/);
    expect(e.text).toContain("1 candidatura parada há 14 dias ou mais");
    expect(e.text).not.toContain("Caio");
    const n = emails.length;
    await dailyDigest(TERCA);
    expect(emails.slice(n).some((x) => x.to === adminEmail)).toBe(false);
  });
  it("semanal: só na segunda, ao dono sem acesso, com contagens e Pedir acesso que avisa os administradores", async () => {
    expect(await weeklyOwnerDigest(200, TERCA)).toBe(0);
    const antes = emails.length;
    expect(await weeklyOwnerDigest(200, SEGUNDA)).toBeGreaterThanOrEqual(1);
    const e = emails.slice(antes).find((x) => x.to === "dora@faxina.exemplo")!;
    expect(e.subject).toMatch(/resumo da semana/);
    expect(e.text).toMatch(/em análise/);
    expect(e.text).not.toMatch(/Caio|Ana|Bia/);
    const link = /Pedir acesso: (\S+)/.exec(e.text)![1];
    const t = new URL(link).searchParams.get("t")!;
    const n = emails.length;
    await weeklyOwnerDigest(200, SEGUNDA);
    expect(emails.slice(n).some((x) => x.to === "dora@faxina.exemplo")).toBe(false);
    const ruim = await pedirAcessoPost(apiRequest(`/api/publico/${empresa.slug}/pedir-acesso`, { method: "POST", body: { t: "x" } }), params({ empresa: empresa.slug }));
    expect(ruim.status).toBe(404);
    const semOrigem = await pedirAcessoPost(apiRequest(`/api/publico/${empresa.slug}/pedir-acesso`, { method: "POST", body: { t }, origin: null }), params({ empresa: empresa.slug }));
    expect(semOrigem.status).toBe(403);
    const ok = await pedirAcessoPost(apiRequest(`/api/publico/${empresa.slug}/pedir-acesso`, { method: "POST", body: { t } }), params({ empresa: empresa.slug }));
    expect(ok.status).toBe(200);
    const aviso = emails.slice(n).find((x) => x.to === adminEmail && /pediu acesso/.test(x.subject));
    expect(aviso).toBeTruthy();
    const { count } = await db().from("rs_eventos").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("tipo", "acesso_pedido");
    expect(count).toBe(1);
  });
});
