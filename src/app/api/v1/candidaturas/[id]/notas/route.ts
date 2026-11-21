// POST /api/v1/candidaturas/{id}/notas (8.5; 13.2, 11.34). Escrita: {texto} (1–10.000). A nota fica
// assinada como "Integração · {nome da chave}".
import type { NextRequest } from "next/server";
import { z } from "zod";
import { NOTA_MAX } from "@/lib/limits";
import { corpo, idDaRota } from "@/server/api/jobs";
import { NotaCriada, apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { addNote } from "@/server/recruiting/pipeline";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const texto = z.string().trim().min(1).max(NOTA_MAX).safeParse((await corpo(req)).texto);
    if (!texto.success) throw new CamposInvalidos([{ campo: "texto", codigo: "nota_invalida" }]);
    return Response.json(NotaCriada.parse(await addNote(ctx, id, texto.data)), { status: 201 });
  });
}
