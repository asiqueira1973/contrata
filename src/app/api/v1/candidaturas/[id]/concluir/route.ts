// /api/v1/candidaturas/{id}/concluir (8.4; 13.2; emenda v0.4.4). POST (escrita): confere o
// `concluir_token` (1 h, ligado ao id) e o currículo pelos bytes, marca a candidatura recebida e
// manda ao candidato o e-mail com o link /c. Idempotente.
import type { NextRequest } from "next/server";
import { corpo, idDaRota } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { DomainError } from "@/server/http";
import { completeApplication, empresaParaCandidatura } from "@/server/recruiting/applications";

type Ctx = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, { params }: Ctx) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const body = await corpo(req);
    const empresa = await empresaParaCandidatura({ id: ctx.empresa.id });
    if (!empresa) throw new DomainError("nao_encontrado", 404);
    await completeApplication({ empresa, id, concluirToken: body.concluir_token, ator: ctx.ator });
    return Response.json({ id, recebida: true });
  });
}
