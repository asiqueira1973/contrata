// POST /sair — encerra a sessão (seção 6.1). É formulário POST; nunca <Link href="/sair">.
// Confere o Origin (seção 20.3): sem isso, um formulário em outro site derrubaria a sessão de
// quem o visitasse. Apaga o cookie rs_sessao e volta para a página inicial.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";
import { jsonError, originAllowed } from "@/server/http";

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return jsonError("origem_invalida", 403);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}
