// [Público] POST /api/publico/links — "Perdi o link" sem empresa, da página /c (6.2): um e-mail por
// empresa, cada um só com os links daquela empresa (11.27). Só do próprio site (Origin). Resposta
// sempre igual.
import type { NextRequest } from "next/server";
import { copy } from "@/lib/copy";
import { errorResponse, ipDaRequisicao, jsonError, originAllowed } from "@/server/http";
import { resendLinks } from "@/server/recruiting/applications";

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  try {
    const corpo = (await req.json().catch(() => ({}))) as { email?: unknown };
    await resendLinks({ email: corpo.email, ip: ipDaRequisicao(req) });
    return Response.json({ mensagem: copy.perdiLink.resposta });
  } catch (e) {
    return errorResponse(e);
  }
}
