// GET /api/v1/candidaturas/{id}/curriculo (8.5; 13.2). Leitura: {texto} extraído (até 100.000
// caracteres; aviso quando não há texto legível) ou, com ?formato=arquivo, {url} pré-assinada de
// 5 minutos para o arquivo original.
import type { NextRequest } from "next/server";
import { idDaRota } from "@/server/api/jobs";
import { CurriculoV1, apiRoute } from "@/server/api/v1";
import { readResume } from "@/server/recruiting/pipeline";

export function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "leitura", async (ctx) => {
    const arquivo = req.nextUrl.searchParams.get("formato") === "arquivo";
    const r = await readResume(ctx, await idDaRota(params), { link: arquivo, texto: !arquivo });
    return Response.json(CurriculoV1.parse(r));
  });
}
