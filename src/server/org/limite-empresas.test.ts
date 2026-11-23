// Limite de empresas por conta na instância aberta (v0.4.19): quem entra pelo "*" de
// CRIACAO_EMPRESA_EMAILS cria uma empresa (a excluída não conta); quem está nominalmente na lista
// não tem limite. O banco confere, inclusive com dois pedidos ao mesmo tempo.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { getUserById } from "@/server/db/users";
import { createCompany } from "./companies";
import { cleanup, createTestUser, trackCompany } from "../../../tests/helpers";

const ENV = process.env.CRIACAO_EMPRESA_EMAILS;
afterEach(() => { process.env.CRIACAO_EMPRESA_EMAILS = ENV; });
afterAll(cleanup);

const slug = () => `lim-${randomUUID().slice(0, 10)}`;
async function criar(u: Awaited<ReturnType<typeof getUserById>>) {
  try {
    const r = await createCompany(u!, { nome: "Empresa Limite", slug: slug(), email_contato: u!.email });
    trackCompany(r.id);
    return "ok";
  } catch (e) {
    return (e as { codigo?: string }).codigo ?? "erro";
  }
}

describe("limite de empresas por conta (instância aberta)", () => {
  it("pelo *, a segunda empresa é recusada com limite_empresas", async () => {
    process.env.CRIACAO_EMPRESA_EMAILS = "dono@instancia.exemplo,*";
    const u = await getUserById((await createTestUser()).id);
    expect(await criar(u)).toBe("ok");
    expect(await criar(u)).toBe("limite_empresas");
  });

  it("dois pedidos ao mesmo tempo: só um passa", async () => {
    process.env.CRIACAO_EMPRESA_EMAILS = "*";
    const u = await getUserById((await createTestUser()).id);
    const r = await Promise.all([criar(u), criar(u)]);
    expect(r.sort()).toEqual(["limite_empresas", "ok"]);
  });

  it("a empresa excluída não conta: depois de excluir, cria outra", async () => {
    process.env.CRIACAO_EMPRESA_EMAILS = "*";
    const u = await getUserById((await createTestUser()).id);
    expect(await criar(u)).toBe("ok");
    await db().from("rs_empresas").update({ excluida_em: new Date().toISOString() }).eq("criada_por_usuario_id", u!.id);
    expect(await criar(u)).toBe("ok");
  });

  it("quem está nominalmente na lista não tem limite", async () => {
    const t = await createTestUser();
    process.env.CRIACAO_EMPRESA_EMAILS = `${t.email},*`;
    const u = await getUserById(t.id);
    expect(await criar(u)).toBe("ok");
    expect(await criar(u)).toBe("ok");
    expect(await criar(u)).toBe("ok");
  });
});
