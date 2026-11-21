// [Público] GET /{empresa}/vagas.xml — feed de vagas publicadas (seção 14.3; critério do 8.3).
// Só empresa com página publicada; só vagas publicadas. Cache de 60 s na borda (seção 17).
import { feedXml } from "@/server/careers/feed";
import { requireEmpresaPublica, vagasPublicadas } from "@/server/careers/public";
import { siteOrigin } from "@/server/oauth/server";

export async function GET(_req: Request, { params }: { params: Promise<{ empresa: string }> }) {
  const empresa = await requireEmpresaPublica((await params).empresa);
  if (!empresa) return new Response("Not found", { status: 404 });
  const xml = feedXml(empresa, await vagasPublicadas(empresa.id), siteOrigin());
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
