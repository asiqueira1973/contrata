// GET /api/v1/empresa — empresa, nome da chave e escopos (13.2, escopo leitura).
import type { NextRequest } from "next/server";
import { apiRoute, EmpresaV1 } from "@/server/api/v1";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) =>
    Response.json(EmpresaV1.parse({ empresa: { id: ctx.empresa.id, slug: ctx.empresa.slug, nome: ctx.empresa.nome }, credencial: { nome: ctx.credencial.nome, escopos: ctx.escopos } })),
  );
}
