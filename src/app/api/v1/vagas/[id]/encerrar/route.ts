// POST /api/v1/vagas/{id}/encerrar (8.3, 8.6; 13.2, 12.1, 11.7): sem candidatura em andamento,
// encerra com o motivo (200). Com candidatura em andamento é decisão sobre pessoas: vira proposta
// encerrar_vaga (202 {decisao_id}), com a devolutiva que cada pessoa vai receber (11.5), e só
// acontece quando alguém da equipe confirmar no formulário de propostas. Escopo decisao.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MOTIVOS_ENCERRAMENTO } from "@/lib/limits";
import { corpo, idDaRota, vagaV1 } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { db } from "@/server/db/client";
import { CamposInvalidos } from "@/server/http";
import { proposeDecision } from "@/server/recruiting/decisions";
import { getJob, transitionJob } from "@/server/recruiting/jobs";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "decisao", async (ctx) => {
    const id = await idDaRota(params);
    const body = await corpo(req);
    const motivo = z.enum(MOTIVOS_ENCERRAMENTO).safeParse(body.motivo);
    if (!motivo.success) throw new CamposInvalidos([{ campo: "motivo", codigo: "motivo_obrigatorio" }]);
    const vaga = await getJob(ctx, id);
    const { count, error } = await db().from("rs_candidaturas").select("id", { count: "exact", head: true })
      .eq("vaga_id", vaga.id).eq("situacao", "ativa").not("recebida_em", "is", null);
    if (error) throw error;
    if (count) {
      const r = await proposeDecision(ctx, {
        tipo: "encerrar_vaga", vaga: vaga.id, justificativa: typeof body.justificativa === "string" ? body.justificativa : null,
        payload: { motivo_encerramento: motivo.data, devolutiva: body.devolutiva, ...(typeof body.assunto === "string" ? { assunto: body.assunto } : {}) },
      });
      return Response.json(r, { status: 202 });
    }
    await transitionJob(ctx, id, "encerrada", motivo.data);
    return Response.json(vagaV1(await getJob(ctx, id)));
  });
}
