// [Público] GET /api/publico/{empresa}/vagas/{slug} (seção 13.2): uma vaga publicada, sem dados
// internos. Pausada, encerrada ou rascunho: 404 (a API pública só lista publicadas, critério 8.3).
import { jsonError } from "@/server/http";
import { requireEmpresaPublica, vagaPublica } from "@/server/careers/public";
import { CORS_PUBLICO, vagaDaApiPublica } from "@/server/careers/api-publica";

export async function GET(_req: Request, { params }: { params: Promise<{ empresa: string; slug: string }> }) {
  const { empresa: slugEmpresa, slug } = await params;
  const empresa = await requireEmpresaPublica(slugEmpresa);
  const vaga = empresa ? await vagaPublica(empresa.id, slug) : null;
  if (!empresa || !vaga || vaga.status !== "publicada") {
    const r = jsonError("nao_encontrado", 404);
    for (const [k, v] of Object.entries(CORS_PUBLICO)) r.headers.set(k, v);
    return r;
  }
  return Response.json(vagaDaApiPublica(empresa, vaga), { headers: CORS_PUBLICO });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_PUBLICO });
}
