// PUT /api/v1/vagas/{id}/equipe (8.3; 13.2, 7.3): substitui a equipe {responsavel, avaliadores};
// o dono com acesso continua como avaliador (11.31). Escrita.
import type { NextRequest } from "next/server";
import { corpo, idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { entradaDaVaga, getJob, saveJob, validarVaga } from "@/server/recruiting/jobs";

export function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const body = await corpo(req);
    const dados = validarVaga({ ...entradaDaVaga(await getJob(ctx, id)), equipe: { responsavel: body.responsavel ?? null, avaliadores: body.avaliadores ?? [] } });
    await saveJob(ctx, id, dados, { equipe: true });
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
