// GET /api/v1/vagas/{id}/resumo (8.3; 13.2): contagens do funil (por etapa e situação,
// sinalizadas, paradas, idade média). Leitura. Usado pelo n8n no fluxo 9.3.
import type { NextRequest } from "next/server";
import { idDaRota } from "@/server/api/jobs";
import { ResumoVagaV1, apiRoute } from "@/server/api/v1";
import { jobSummary } from "@/server/recruiting/jobs";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "leitura", async (ctx) => Response.json(ResumoVagaV1.parse(await jobSummary(ctx, await idDaRota(params)))));
}
