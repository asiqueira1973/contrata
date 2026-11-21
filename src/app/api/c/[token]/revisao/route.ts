// POST /api/c/{token}/revisao — "Pedir revisão" (11.13; 8.6): uma vez, para candidatura reprovada
// ou encerrada com a vaga, com texto opcional de até 1.000; avisa o responsável da vaga.
// Guardião: o token (requireCandidaturaPorToken, no domínio) e Origin do próprio site.
import type { NextRequest } from "next/server";
import { copy } from "@/lib/copy";
import { errorResponse, jsonError, originAllowed } from "@/server/http";
import { requestReview } from "@/server/recruiting/applications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  try {
    const corpo = (await req.json().catch(() => ({}))) as { texto?: unknown };
    await requestReview((await params).token, corpo.texto);
    return Response.json({ mensagem: copy.acompanhamento.revisao.enviada });
  } catch (e) {
    return errorResponse(e);
  }
}
