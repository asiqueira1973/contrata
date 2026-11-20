// GET /api/v1/areas — áreas ativas da empresa (13.2, escopo leitura), paginadas por cursor.
import type { NextRequest } from "next/server";
import { AreaV1, apiRoute, pagina, paginar } from "@/server/api/v1";
import { listAreas } from "@/server/org/areas";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const areas = (await listAreas(ctx.empresa.id)).map((a) => AreaV1.parse({ id: a.id, nome: a.nome, responsavel: a.responsavel, vagas_abertas: a.vagas_abertas }));
    return Response.json(paginar(areas, pagina(req)));
  });
}
