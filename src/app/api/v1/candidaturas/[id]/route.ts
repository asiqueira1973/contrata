// GET /api/v1/candidaturas/{id} (8.5; 13.2). Leitura: dados, respostas (com o selo da 11.10),
// etapa, situação, todas as avaliações (11.9: a API vê tudo), notas, mensagens e os metadados do
// currículo. O texto do currículo vem por /curriculo.
import type { NextRequest } from "next/server";
import { candidaturaV1 } from "@/server/api/applications";
import { idDaRota } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { getApplication } from "@/server/recruiting/pipeline";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "leitura", async (ctx) => Response.json(candidaturaV1(await getApplication(ctx, await idDaRota(params)))));
}
