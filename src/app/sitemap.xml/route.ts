// [Público] GET /sitemap.xml (seção 17): a página inicial, a documentação e os textos legais (8.12),
// as páginas de carreiras publicadas e as vagas publicadas, com lastmod. Rota (e não sitemap.ts) para não consultar o banco no build.
import { paginasParaSitemap } from "@/server/careers/public";
import { siteOrigin } from "@/server/oauth/server";

// Páginas institucionais fixas (8.12), na ordem do rodapé.
const PAGINAS_FIXAS = ["/", "/docs/mcp", "/docs/api", "/docs/auto-hospedagem", "/privacidade", "/termos"];

function url(loc: string, lastmod?: string): string {
  return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`;
}

export async function GET() {
  const site = siteOrigin();
  const paginas = await paginasParaSitemap();
  const urls = [
    ...PAGINAS_FIXAS.map((p) => url(`${site}${p}`)),
    ...paginas.flatMap((p) => [url(`${site}/${p.slug}`, p.atualizado_em), ...p.vagas.map((v) => url(`${site}/${p.slug}/vagas/${v.slug}`, v.atualizado_em))]),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
