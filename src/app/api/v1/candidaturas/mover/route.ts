// POST /api/v1/candidaturas/mover (8.5; 13.2, 11.30). Escrita: {ids, etapa_id}, de 1 a 100
// candidaturas em andamento da mesma vaga; tudo ou nada.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MOVER_LOTE_MAX } from "@/lib/limits";
import { corpo } from "@/server/api/jobs";
import { Movidas, apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { moveStage } from "@/server/recruiting/pipeline";

const schema = z.object({ ids: z.array(z.uuid()).min(1).max(MOVER_LOTE_MAX), etapa_id: z.uuid() });

export function POST(req: NextRequest) {
  return apiRoute(req, "escrita", async (ctx) => {
    const p = schema.safeParse(await corpo(req));
    if (!p.success) throw new CamposInvalidos([...new Set(p.error.issues.map((i) => String(i.path[0])))].map((campo) => ({ campo, codigo: campo === "ids" ? "lote_invalido" : "campo_invalido" })));
    const r = await moveStage(ctx, p.data.ids, p.data.etapa_id);
    return Response.json(Movidas.parse({ movidas: r.movidas, etapa: { id: p.data.etapa_id, nome: r.etapa } }));
  });
}
