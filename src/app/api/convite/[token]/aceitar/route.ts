// POST /api/convite/{token}/aceitar — aceita o convite com a conta logada (6.1, regra 11.24: só
// se o e-mail da conta Google for igual ao convidado). Devolve {empresa: slug}.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth/require-usuario";
import { errorResponse } from "@/server/http";
import { acceptInvite } from "@/server/org/members";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/convite/[token]/aceitar">) {
  const usuario = await requireUsuario(req);
  if (usuario instanceof Response) return usuario;
  const { token } = await ctx.params;
  try {
    return Response.json({ empresa: await acceptInvite(usuario.id, token) });
  } catch (e) {
    return errorResponse(e);
  }
}
