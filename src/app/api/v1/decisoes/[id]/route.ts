// GET /api/v1/decisoes/{id} (8.6; 13.2): uma proposta, com status e se ainda vale. Leitura.
import type { NextRequest } from "next/server";
import { idDaRota } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { DomainError } from "@/server/http";
import { listProposals } from "@/server/recruiting/decisions";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "leitura", async (ctx) => {
    const [p] = await listProposals(ctx, { id: await idDaRota(params) });
    if (!p) throw new DomainError("nao_encontrado", 404);
    return Response.json(p);
  });
}
