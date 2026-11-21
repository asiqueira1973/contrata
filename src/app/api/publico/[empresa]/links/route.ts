// [Público] POST /api/publico/{empresa}/links — "Perdi o link" da empresa (6.2, 13.1). Resposta
// sempre igual, exista ou não candidatura; limites por IP e por e-mail calam o excesso.
import { copy } from "@/lib/copy";
import { comCors, corsDoPost } from "@/server/careers/api-publica";
import { requireEmpresaPublica } from "@/server/careers/public";
import { errorResponse, ipDaRequisicao, jsonError } from "@/server/http";
import { resendLinks } from "@/server/recruiting/applications";

export async function POST(req: Request, { params }: { params: Promise<{ empresa: string }> }) {
  const cors = corsDoPost(req);
  const empresa = await requireEmpresaPublica((await params).empresa);
  if (!empresa) return comCors(jsonError("nao_encontrado", 404), cors);
  try {
    const corpo = (await req.json().catch(() => ({}))) as { email?: unknown };
    await resendLinks({ email: corpo.email, empresaId: empresa.id, ip: ipDaRequisicao(req) });
    return comCors(Response.json({ mensagem: copy.perdiLink.resposta }), cors);
  } catch (e) {
    return comCors(errorResponse(e), cors);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsDoPost(req) });
}
