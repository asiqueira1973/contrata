// POST /api/c/{token}/excluir/codigo — pede o código de 6 dígitos por e-mail (11.13). Devolve o
// e-mail mascarado. Guardião: o token e Origin do próprio site.
import type { NextRequest } from "next/server";
import { errorResponse, jsonError, originAllowed } from "@/server/http";
import { requestDeletionCode } from "@/server/recruiting/applications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  try {
    return Response.json(await requestDeletionCode((await params).token));
  } catch (e) {
    return errorResponse(e);
  }
}
