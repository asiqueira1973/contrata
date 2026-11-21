// POST /api/v1/candidaturas/{id}/reprovar (8.6; 13.2, 11.5, 11.7): {motivo, devolutiva,
// justificativa?}. Reprovar é decisão: pela API vira SEMPRE proposta (202 {decisao_id}), com
// qualquer escopo; só acontece quando alguém da equipe confirmar no formulário de propostas.
import type { NextRequest } from "next/server";
import { corpo, idDaRota } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { proposeDecision } from "@/server/recruiting/decisions";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "decisao", async (ctx) => {
    const id = await idDaRota(params);
    const { justificativa, ...payload } = await corpo(req);
    const r = await proposeDecision(ctx, { tipo: "reprovar", candidatura: id, payload, justificativa: typeof justificativa === "string" ? justificativa : null });
    return Response.json(r, { status: 202 });
  });
}
