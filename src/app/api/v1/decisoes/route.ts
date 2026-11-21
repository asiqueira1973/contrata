// GET /api/v1/decisoes (8.6; 13.2): propostas de decisão da empresa, com filtro status. Leitura.
// Confirmar e descartar não têm porta na API (princípio 2): só pelo formulário de propostas.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { listProposals } from "@/server/recruiting/decisions";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const st = req.nextUrl.searchParams.get("status");
    const status = st === null ? undefined : z.enum(["pendente", "confirmada", "descartada", "expirada"]).safeParse(st);
    if (status && !status.success) throw new CamposInvalidos([{ campo: "status", codigo: "campo_invalido" }]);
    return Response.json({ itens: await listProposals(ctx, status ? { status: status.data } : {}) });
  });
}
