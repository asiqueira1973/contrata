// POST /api/c/{token}/excluir — exclui os dados com o código (11.13; 7.4), na hora. Guardião: o
// token e Origin do próprio site.
import type { NextRequest } from "next/server";
import { copy } from "@/lib/copy";
import { errorResponse, jsonError, originAllowed } from "@/server/http";
import { deleteData } from "@/server/recruiting/applications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  try {
    const corpo = (await req.json().catch(() => ({}))) as { codigo?: unknown };
    const r = await deleteData((await params).token, corpo.codigo);
    return Response.json({ mensagem: copy.acompanhamento.excluidos(r.empresa) });
  } catch (e) {
    return errorResponse(e);
  }
}
