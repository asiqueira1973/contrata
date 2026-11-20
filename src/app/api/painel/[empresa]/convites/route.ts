// POST /api/painel/{e}/convites — convida um membro (seção 5: só administrador; regra 11.24).
// Corpo: {email, papel, todas_areas, areas}. Devolve 201 {id}. Sem porta de API nem MCP (13.2).
import type { NextRequest } from "next/server";
import { conviteSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { inviteMember } from "@/server/org/members";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/convites">) {
  const m = await requireMembro(req, (await ctx.params).empresa, "administrador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, conviteSchema);
  if (body instanceof Response) return body;
  try {
    return Response.json({ id: await inviteMember(m, body) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
