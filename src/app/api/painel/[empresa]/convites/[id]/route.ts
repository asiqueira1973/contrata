// DELETE /api/painel/{e}/convites/{id} — cancela um convite pendente (administrador, 11.24).
import type { NextRequest } from "next/server";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse } from "@/server/http";
import { cancelInvite } from "@/server/org/members";

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/convites/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  try {
    await cancelInvite(m, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
