// POST /api/c/{token}/retirar — "Retirar candidatura" (11.13, 12.2): desistiu, com a confirmação
// por e-mail. Guardião: o token (requireCandidaturaPorToken, no domínio) e Origin do próprio site.
import type { NextRequest } from "next/server";
import { copy } from "@/lib/copy";
import { errorResponse, jsonError, originAllowed } from "@/server/http";
import { withdraw } from "@/server/recruiting/applications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  try {
    await withdraw((await params).token);
    return Response.json({ mensagem: copy.acompanhamento.retirada });
  } catch (e) {
    return errorResponse(e);
  }
}
