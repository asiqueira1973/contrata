// POST /api/v1/candidaturas/{id}/mover (8.5; 13.2, 11.30). Escrita: {etapa_id}. Só candidatura em
// andamento, para uma etapa da mesma vaga; fica na trilha como "Integração · {chave}".
import type { NextRequest } from "next/server";
import { z } from "zod";
import { corpo, idDaRota } from "@/server/api/jobs";
import { Movidas, apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { moveStage } from "@/server/recruiting/pipeline";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const etapa = z.uuid().safeParse((await corpo(req)).etapa_id);
    if (!etapa.success) throw new CamposInvalidos([{ campo: "etapa_id", codigo: "campo_invalido" }]);
    const r = await moveStage(ctx, [id], etapa.data);
    return Response.json(Movidas.parse({ movidas: r.movidas, etapa: { id: etapa.data, nome: r.etapa } }));
  });
}
