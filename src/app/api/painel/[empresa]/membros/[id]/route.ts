// PATCH /api/painel/{e}/membros/{id} — muda papel e áreas (11.32; revoga tokens MCP, 6.3).
// DELETE — remove o membro (7.4). Os dois só para administrador e recusam o último (11.26).
import type { NextRequest } from "next/server";
import { acessoSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { changeAccess, removeMember } from "@/server/org/members";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/membros/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, acessoSchema);
  if (body instanceof Response) return body;
  try {
    await changeAccess(m, id, body);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/membros/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  try {
    await removeMember(m, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
