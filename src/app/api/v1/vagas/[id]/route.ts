// /api/v1/vagas/{id} (8.3; 13.2). GET (leitura): a vaga. PATCH (escrita): muda os campos
// enviados (11.1, mesmo schema do formulário); etapas, perguntas e equipe têm PUT próprio.
import type { NextRequest } from "next/server";
import { CAMPOS_PATCH, corpo, idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { entradaDaVaga, getJob, saveJob, validarVaga } from "@/server/recruiting/jobs";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return apiRoute(req, "leitura", async (ctx) => Response.json(vagaV1(await getJob(ctx, await idDaRota(params)))));
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return apiRoute(req, "escrita", async (ctx) => {
    const id = await idDaRota(params);
    const body = await corpo(req);
    const estranhos = Object.keys(body).filter((k) => !(CAMPOS_PATCH as readonly string[]).includes(k));
    if (estranhos.length) throw new CamposInvalidos(estranhos.map((campo) => ({ campo, codigo: "campo_invalido" })));
    const dados = validarVaga({ ...entradaDaVaga(await getJob(ctx, id)), ...body });
    await saveJob(ctx, id, dados, {});
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
