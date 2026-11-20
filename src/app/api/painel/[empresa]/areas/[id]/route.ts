// PATCH /api/painel/{e}/areas/{id} — renomeia e troca o responsável. DELETE — arquiva (7.4).
// Só administrador (seção 5).
import type { NextRequest } from "next/server";
import { areaSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { archiveArea, saveArea } from "@/server/org/areas";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/areas/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, areaSchema);
  if (body instanceof Response) return body;
  try {
    await saveArea(m, id, body);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/areas/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  try {
    await archiveArea(m, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
