// POST /api/v1/vagas/{id}/encerrar (8.3; 13.2, 12.1): sem candidatura em andamento, encerra com o
// motivo (200). Escopo decisao. Com candidatura em andamento é decisão sobre pessoas (11.7): até o
// épico 8.6 responde 409 vaga_com_ativas; depois vira proposta (202 {decisao_id}).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MOTIVOS_ENCERRAMENTO } from "@/lib/limits";
import { corpo, idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { getJob, transitionJob } from "@/server/recruiting/jobs";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "decisao", async (ctx) => {
    const id = await idDaRota(params);
    const motivo = z.enum(MOTIVOS_ENCERRAMENTO).safeParse((await corpo(req)).motivo);
    if (!motivo.success) throw new CamposInvalidos([{ campo: "motivo", codigo: "motivo_obrigatorio" }]);
    await transitionJob(ctx, id, "encerrada", motivo.data);
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
