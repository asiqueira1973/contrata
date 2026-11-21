// POST /api/v1/vagas/{id}/publicar (8.3; 13.2, 12.1): vaga → publicada. Escrita. Confere a 11.1 (o que falta
// volta em campos) e o limite de vagas publicadas (11.14).
import type { NextRequest } from "next/server";
import { idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { getJob, transitionJob } from "@/server/recruiting/jobs";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    await transitionJob(ctx, id, "publicada");
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
