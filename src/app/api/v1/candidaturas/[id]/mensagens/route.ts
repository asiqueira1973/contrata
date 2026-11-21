// POST /api/v1/candidaturas/{id}/mensagens (8.6; 13.2, 11.8): {modelo?, assunto?, corpo?,
// justificativa?}. Segue mensagens_agente da empresa: "direto" envia na hora (201, até 200 por
// dia vindas de chaves de API); "confirmar" (padrão) vira proposta (202 {decisao_id}). Escopo escrita.
import type { NextRequest } from "next/server";
import { copy } from "@/lib/copy";
import { corpo, idDaRota } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { sendMessageFromApi } from "@/server/recruiting/messages";

const texto = (v: unknown) => (typeof v === "string" ? v : null);

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const b = await corpo(req);
    const r = await sendMessageFromApi(ctx, id, { modelo: texto(b.modelo), assunto: texto(b.assunto), corpo: texto(b.corpo), justificativa: texto(b.justificativa) });
    if (r.enviada) return Response.json({ mensagem_id: r.mensagem_id }, { status: 201 });
    return Response.json({ decisao_id: r.decisao_id, mensagem: copy.decisoes.propostaCriada }, { status: 202 });
  });
}
