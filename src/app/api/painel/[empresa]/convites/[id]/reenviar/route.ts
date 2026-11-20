// POST /api/painel/{e}/convites/{id}/reenviar — token novo, prazo novo, e-mail de novo (11.24).
import type { NextRequest } from "next/server";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse } from "@/server/http";
import { resendInvite } from "@/server/org/members";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/convites/[id]/reenviar">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  try {
    await resendInvite(m, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
