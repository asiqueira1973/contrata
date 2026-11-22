// GET /api/v1/eventos (8.8; 13.2): a trilha da empresa depois de ?desde={id}, em ordem crescente,
// para sincronização incremental; ?limite= (padrão 50, máximo 200); proximo_desde quando há mais.
// Leitura.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute, LIMITE_MAX, LIMITE_PADRAO } from "@/server/api/v1";
import { listEvents } from "@/server/audit/events";
import { CamposInvalidos } from "@/server/http";

const filtros = z.object({
  desde: z.coerce.number().int().min(0).default(0),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAX).default(LIMITE_PADRAO),
});

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const sp = req.nextUrl.searchParams;
    const f = filtros.safeParse({ desde: sp.get("desde") ?? undefined, limite: sp.get("limite") ?? undefined });
    if (!f.success) throw new CamposInvalidos(f.error.issues.map((i) => ({ campo: String(i.path[0]), codigo: "campo_invalido" })));
    return Response.json(await listEvents(ctx, f.data.desde, f.data.limite));
  });
}
