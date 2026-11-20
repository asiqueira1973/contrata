// POST /api/painel/{e}/pessoas/{id}/acesso — "Dar acesso": convite para o e-mail da pessoa
// (seção 5: só administrador; 7.5 rs_fn_da_acesso). Corpo: {papel, todas_areas, areas}.
import type { NextRequest } from "next/server";
import { acessoSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { grantAccess } from "@/server/org/members";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/pessoas/[id]/acesso">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, acessoSchema);
  if (body instanceof Response) return body;
  try {
    return Response.json({ id: await grantAccess(m, id, body) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
