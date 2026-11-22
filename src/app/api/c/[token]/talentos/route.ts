// POST /api/c/{token}/talentos — banco de talentos pelo link de acompanhamento (8.7; 11.13, 15.1):
// {acao: entrar | renovar | sair}. Guardião: o token (requireCandidaturaPorToken, no domínio) e
// Origin do próprio site.
import type { NextRequest } from "next/server";
import { errorResponse, jsonError, originAllowed } from "@/server/http";
import { talentAction } from "@/server/recruiting/talents";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  try {
    const b = (await req.json().catch(() => ({}))) as { acao?: unknown };
    return Response.json(await talentAction((await params).token, b.acao));
  } catch (e) {
    return errorResponse(e);
  }
}
