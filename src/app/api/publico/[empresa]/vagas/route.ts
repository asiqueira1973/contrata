// [Público] GET /api/publico/{empresa}/vagas (seção 13.2; critério do 8.3): vagas publicadas da
// empresa com página publicada, sem dados internos (dono, equipe, candidaturas). Sem chave; CORS
// aberto só nas leituras públicas; cache de 60 s na borda.
import { jsonError } from "@/server/http";
import { requireEmpresaPublica, vagasPublicadas } from "@/server/careers/public";
import { CORS_PUBLICO, vagaDaApiPublica } from "@/server/careers/api-publica";

export async function GET(_req: Request, { params }: { params: Promise<{ empresa: string }> }) {
  const empresa = await requireEmpresaPublica((await params).empresa);
  if (!empresa) return withCors(jsonError("nao_encontrado", 404));
  const vagas = (await vagasPublicadas(empresa.id)).map((v) => vagaDaApiPublica(empresa, v));
  return Response.json({ empresa: { slug: empresa.slug, nome: empresa.nome }, vagas }, { headers: CORS_PUBLICO });
}

function withCors(r: Response): Response {
  for (const [k, v] of Object.entries(CORS_PUBLICO)) r.headers.set(k, v);
  return r;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_PUBLICO });
}
