// [Público] POST /api/publico/{empresa}/candidaturas/{id}/concluir (13.1; 9.2; 8.4). Confere o
// token de conclusão (1 h, ligado ao id) e o currículo pelos bytes, marca recebida e manda o
// e-mail com o link /c; a extração do texto roda depois da resposta. Idempotente.
import { copy } from "@/lib/copy";
import { comCors, corsDoPost } from "@/server/careers/api-publica";
import { requireEmpresaPublica } from "@/server/careers/public";
import { errorResponse, jsonError } from "@/server/http";
import { ATOR_CANDIDATO, completeApplication, empresaParaCandidatura } from "@/server/recruiting/applications";

type Ctx = { params: Promise<{ empresa: string; id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const cors = corsDoPost(req);
  const { empresa: slugEmpresa, id } = await params;
  const publica = await requireEmpresaPublica(slugEmpresa);
  const empresa = publica ? await empresaParaCandidatura({ id: publica.id }) : null;
  if (!empresa) return comCors(jsonError("nao_encontrado", 404), cors);
  try {
    const corpo = (await req.json().catch(() => ({}))) as { concluir_token?: unknown };
    await completeApplication({ empresa, id, concluirToken: corpo.concluir_token, ator: ATOR_CANDIDATO });
    return comCors(Response.json({ recebida: true, mensagem: copy.candidatura.enviadaTitulo }), cors);
  } catch (e) {
    return comCors(errorResponse(e), cors);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsDoPost(req) });
}
