// Limite de candidaturas por vaga (11.14): a recusa não diz o motivo — o mesmo envio_recusado do
// limite por IP e do campo-armadilha. O teto é baixado para 1 só neste arquivo.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as criarPost } from "./[empresa]/vagas/[slug]/candidaturas/route";
import { apiRequest, cleanup, createPublishedJob, createTestCompany, createTestUser, params } from "../../../../tests/helpers";

vi.mock("@/lib/limits", async (original) => ({ ...(await original<typeof import("@/lib/limits")>()), CANDIDATURAS_POR_VAGA_MAX: 1 }));

let empresa: Awaited<ReturnType<typeof createTestCompany>>;
let vaga: { id: string; slug: string };
let ip = 0;
const corpo = (email: string) => ({ nome: "Rita Lopes", email, aceite_privacidade: true, curriculo: { nome: "cv.pdf", tipo: "application/pdf", bytes: 1000 } });
const envia = (email: string) => {
  const r = apiRequest(`/api/publico/${empresa.slug}/vagas/${vaga.slug}/candidaturas`, { method: "POST", body: corpo(email) });
  r.headers.set("x-forwarded-for", `10.9.0.${++ip}`);
  return criarPost(r, params({ empresa: empresa.slug, slug: vaga.slug }));
};

beforeAll(async () => {
  empresa = await createTestCompany(await createTestUser());
  vaga = await createPublishedJob(empresa);
});
afterAll(cleanup);

describe("limite por vaga (11.14)", () => {
  it("passou do teto: 429 envio_recusado, sem dizer qual limite", async () => {
    expect((await envia("rita1@teste.exemplo")).status).toBe(201);
    const r = await envia("rita2@teste.exemplo");
    expect(r.status).toBe(429);
    expect((await r.json()).codigo).toBe("envio_recusado");
  });
});
