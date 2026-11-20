// PATCH /api/painel/{e}/pessoas/{id} — edita (recrutador e administrador, seção 5).
// DELETE — arquiva (só administrador; 7.4 recusa quem tem acesso ou é dono de vaga aberta).
import type { NextRequest } from "next/server";
import { pessoaSchema } from "@/lib/schemas/org";
import { requireMembro } from "@/server/auth/require-membro";
import { errorResponse, parseBody } from "@/server/http";
import { archivePerson, savePerson } from "@/server/org/people";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/pessoas/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "recrutador");
  if (m instanceof Response) return m;
  const body = await parseBody(req, pessoaSchema);
  if (body instanceof Response) return body;
  try {
    await savePerson(m, id, body);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/painel/[empresa]/pessoas/[id]">) {
  const { empresa, id } = await ctx.params;
  const m = await requireMembro(req, empresa, "administrador");
  if (m instanceof Response) return m;
  try {
    await archivePerson(m, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
