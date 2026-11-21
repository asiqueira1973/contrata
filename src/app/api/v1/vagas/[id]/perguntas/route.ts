// PUT /api/v1/vagas/{id}/perguntas (8.3; 13.2, 11.1): substitui as perguntas (0–10), só antes da
// primeira publicação (depois, perguntas_congeladas, 409). Escrita.
import type { NextRequest } from "next/server";
import { corpo, idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { DomainError } from "@/server/http";
import { entradaDaVaga, getJob, saveJob, validarVaga } from "@/server/recruiting/jobs";

export function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const body = await corpo(req);
    const atual = await getJob(ctx, id);
    if (atual.publicada_em) throw new DomainError("perguntas_congeladas", 409);
    const dados = validarVaga({ ...entradaDaVaga(atual), perguntas: body.perguntas });
    await saveJob(ctx, id, dados, { perguntas: true });
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
