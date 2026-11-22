// Páginas públicas do 8.12 (seções 10.1, 17 e 20): cada uma renderiza, é indexável e tem a
// canônica; o sitemap traz as institucionais; o robots bloqueia o que não se indexa; o aviso de
// privacidade e as páginas legais usam o operador das variáveis; o README cita toda variável do
// .env.example.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import * as inicio from "@/app/(publico)/page";
import * as mcp from "@/app/(publico)/docs/mcp/page";
import * as api from "@/app/(publico)/docs/api/page";
import * as hospedar from "@/app/(publico)/docs/auto-hospedagem/page";
import * as privacidade from "@/app/(publico)/privacidade/page";
import * as termos from "@/app/(publico)/termos/page";
import { GET as sitemapGet } from "@/app/sitemap.xml/route";
import robots from "@/app/robots";
import { cleanup, createTestCompany, createTestToken, createTestUser, listTools } from "../../../tests/helpers";

type Pagina = { metadata: Metadata; default: () => React.ReactElement };
const PAGINAS: [string, Pagina][] = [
  ["/", inicio],
  ["/docs/mcp", mcp],
  ["/docs/api", api],
  ["/docs/auto-hospedagem", hospedar],
  ["/privacidade", privacidade],
  ["/termos", termos],
];

const html = (p: Pagina) => renderToStaticMarkup(createElement(p.default));
const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe("páginas públicas (8.12)", () => {
  it.each(PAGINAS)("%s renderiza, é indexável e tem canônica", (rota, p) => {
    expect(p.metadata.robots).toMatchObject({ index: true, follow: true });
    expect((p.metadata.alternates as { canonical: string }).canonical).toBe(rota);
    const h = html(p);
    expect(h).toContain("<h1");
    expect(h).toContain('href="/privacidade"');
    expect(h).toContain('href="/termos"');
  });

  it("a inicial tem o título, os dois caminhos e o formulário de decisão no chat", () => {
    const h = html(inicio);
    expect(h).toContain(copy.inicio.tituloDestaque);
    expect(h).toContain(copy.inicio.conectar);
    expect(h).toContain('href="/docs/mcp"');
    expect(h).toContain('href="/docs/auto-hospedagem"');
    expect(h).toContain(copy.inicio.chat.botao);
    expect(h).toContain(copy.inicio.naoFaz.titulo);
    expect(h).toContain(copy.inicio.paraQuem.titulo);
  });

  it("/docs/mcp mostra o endereço do conector e o comando do Claude Code", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vagas.exemplo.com.br";
    const h = html(mcp);
    expect(h).toContain("https://vagas.exemplo.com.br/mcp");
    expect(h).toContain("claude mcp add --transport http");
  });

  it("os números da inicial batem com as ferramentas do conector (administrador, com formulários)", async () => {
    const dono = await createTestUser();
    const empresa = await createTestCompany(dono);
    const tools = (await listTools(await createTestToken(empresa.id, empresa.adminMembroId))).map((t) => t.name);
    // Formulários: todos os registrados no servidor, inclusive o desfazer_exclusao, que só aparece
    // com a empresa excluída (8.9).
    const formularios = readFileSync("src/server/mcp/server.ts", "utf8").match(/registrarFormulario\(server, ctx,/g)!.length;
    expect(tools.filter((n) => n.startsWith("abrir_formulario_")).length).toBe(formularios - 1);
    const diretas = tools.filter((n) => !/^(abrir_formulario_|registrar_|salvar_|opcoes_)/.test(n)).length;
    expect(copy.inicio.numeros[0]).toMatch(new RegExp(`^${diretas} `));
    expect(copy.inicio.numeros[1]).toMatch(new RegExp(`^${formularios} `));
    await cleanup();
  });
});

describe("operador da instância (8.12; 20)", () => {
  it("sem OPERADOR_NOME, o aviso e a política dizem 'quem hospeda' e o contato é o ADMIN_EMAIL", () => {
    delete process.env.OPERADOR_NOME;
    delete process.env.OPERADOR_CONTATO;
    process.env.ADMIN_EMAIL = "admin@instancia.exemplo";
    const h = html(privacidade);
    expect(h).toContain(copy.legal.quemHospeda);
    expect(h).toContain("admin@instancia.exemplo");
    expect(copy.avisoPrivacidade("Padaria", "rh@padaria.exemplo", 180, null).join(" ")).toContain("quem hospeda esta instância");
  });

  it("com OPERADOR_NOME e OPERADOR_CONTATO, os textos usam os dois", () => {
    process.env.OPERADOR_NOME = "Operadora Exemplo Ltda.";
    process.env.OPERADOR_CONTATO = "privacidade@operadora.exemplo";
    for (const p of [privacidade, termos]) {
      const h = html(p);
      expect(h).toContain("Operadora Exemplo Ltda.");
      expect(h).toContain("privacidade@operadora.exemplo");
    }
    expect(copy.avisoPrivacidade("Padaria", "rh@padaria.exemplo", 180, "Operadora Exemplo Ltda.").join(" ")).toContain("Operadora Exemplo Ltda.");
  });

  it("nenhum nome de operador escrito à mão na copy", () => {
    expect(readFileSync("src/lib/copy.ts", "utf8")).not.toMatch(/DabLab/);
  });
});

describe("sitemap e robots (17)", () => {
  it("o sitemap traz as páginas institucionais", async () => {
    const xml = await (await sitemapGet()).text();
    for (const [rota] of PAGINAS) expect(xml).toContain(`${rota === "/" ? "/" : rota}</loc>`);
  });

  it("o robots bloqueia o que não se indexa e libera o resto", () => {
    const r = robots();
    const regra = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(regra.allow).toBe("/");
    for (const x of ["/c/", "/api/", "/oauth/", "/mcp", "/entrar", "/sair", "/convite/", "/dev/"]) expect(regra.disallow).toContain(x);
  });
});

describe("README (8.12)", () => {
  it("cita toda variável do .env.example", () => {
    const readme = readFileSync("README.md", "utf8");
    const vars = readFileSync(".env.example", "utf8").split("\n").map((l) => l.match(/^([A-Z][A-Z0-9_]+)=/)?.[1]).filter(Boolean) as string[];
    expect(vars.length).toBeGreaterThan(10);
    const faltam = vars.filter((v) => !readme.includes(`\`${v}\``));
    expect(faltam).toEqual([]);
  });

  it("usa o nome do produto e ensina o caminho do zero", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain(NOME_PRODUTO);
    for (const x of ["supabase db push", "CRIACAO_EMPRESA_EMAILS", "vercel.json", "/api/auth/google/callback", "/mcp"]) expect(readme).toContain(x);
  });
});
