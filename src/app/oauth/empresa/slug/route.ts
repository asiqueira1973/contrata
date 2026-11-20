// GET /oauth/empresa/slug?valor= — o endereço da página de carreiras está livre? (11.20, ao vivo
// no consentimento). Devolve {livre, codigo?}. Só para usuário logado.
import type { NextRequest } from "next/server";
import { requireUsuario } from "@/server/auth/require-usuario";
import { errorResponse } from "@/server/http";
import { slugStatus } from "@/server/org/companies";

export async function GET(req: NextRequest) {
  const usuario = await requireUsuario(req);
  if (usuario instanceof Response) return usuario;
  try {
    const codigo = await slugStatus((req.nextUrl.searchParams.get("valor") ?? "").trim().toLowerCase());
    return Response.json(codigo ? { livre: false, codigo } : { livre: true });
  } catch (e) {
    return errorResponse(e);
  }
}
