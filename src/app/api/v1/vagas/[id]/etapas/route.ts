// PUT /api/v1/vagas/{id}/etapas (8.3; 13.2, 11.22): substitui a lista de etapas (1–15). Etapa com
// candidatura não sai (etapa_com_candidaturas); itens com id renomeiam e reordenam. Escrita.
import type { NextRequest } from "next/server";
import { corpo, idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { entradaDaVaga, getJob, saveJob, validarVaga } from "@/server/recruiting/jobs";

export function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const body = await corpo(req);
    const dados = validarVaga({ ...entradaDaVaga(await getJob(ctx, id)), etapas: body.etapas });
    await saveJob(ctx, id, dados, { etapas: true });
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
