// POST /api/painel/conta/boas-vindas — grava o aceite dos Termos e da Política (seção 6.1:
// sem o aceite, o usuário vê só as boas-vindas). Corpo: {aceite: true}.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUsuario } from "@/server/auth/require-usuario";
import { acceptTerms } from "@/server/db/users";
import { errorResponse, parseBody } from "@/server/http";

const schema = z.object({ aceite: z.literal(true) });

export async function POST(req: NextRequest) {
  const usuario = await requireUsuario(req, { termos: false });
  if (usuario instanceof Response) return usuario;
  const body = await parseBody(req, schema);
  if (body instanceof Response) return body;
  try {
    await acceptTerms(usuario.id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
