// POST /api/v1/vagas/{id}/pausar (8.3; 13.2, 12.1): vaga → pausada. Escrita.
import type { NextRequest } from "next/server";
import { idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { getJob, transitionJob } from "@/server/recruiting/jobs";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    await transitionJob(ctx, id, "pausada");
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
