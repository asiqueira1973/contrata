// POST /api/painel/{e}/pessoas — cadastra pessoa (seção 5: recrutador e administrador).
// Corpo: {nome, email, cargo, area_id, recebe_resumo}. Devolve 201 {id}.
import type { NextRequest } from "next/server";
import { pessoaSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { savePerson } from "@/server/org/people";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/pessoas">) {
  const m = await requireMembro(req, (await ctx.params).empresa, "recrutador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, pessoaSchema);
  if (body instanceof Response) return body;
  try {
    return Response.json({ id: await savePerson(m, null, body) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
