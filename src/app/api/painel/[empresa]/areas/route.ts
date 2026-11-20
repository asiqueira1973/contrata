// POST /api/painel/{e}/areas — cria área (seção 5: só administrador). Corpo: {nome,
// responsavel_pessoa_id}. Devolve 201 {id}. Escrita sem porta de API nem MCP (13.2).
import type { NextRequest } from "next/server";
import { areaSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { saveArea } from "@/server/org/areas";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/areas">) {
  const m = await requireMembro(req, (await ctx.params).empresa, "administrador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, areaSchema);
  if (body instanceof Response) return body;
  try {
    return Response.json({ id: await saveArea(m, null, body) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
