// [Público] POST /api/publico/{empresa}/pedir-acesso (8.10; 11.31): {t} do link do resumo semanal.
// Confere a origem e o token, grava acesso_pedido e avisa os administradores (uma vez por dia).
import type { NextRequest } from "next/server";
import { copy } from "@/lib/copy";
import { empresaPorSlug } from "@/server/careers/public";
import { errorResponse, jsonError, originAllowed } from "@/server/http";
import { requestAccess } from "@/server/org/access-request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  const empresa = await empresaPorSlug((await params).empresa);
  if (!empresa) return jsonError("link_pedir_acesso_invalido", 404);
  try {
    const corpo = (await req.json().catch(() => ({}))) as { t?: unknown };
    await requestAccess(empresa, corpo.t);
    return Response.json({ mensagem: copy.pedirAcesso.pronto });
  } catch (e) {
    return errorResponse(e);
  }
}
