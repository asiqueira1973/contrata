// POST /api/v1/talentos/{candidato_id}/convidar (8.7; 13.2): {vaga_id}. Convida a pessoa do banco
// para uma vaga publicada com o modelo convite_vaga da empresa; não cria candidatura. Sem texto
// livre: mensagem escrita pela API segue a 11.8 (POST /candidaturas/{id}/mensagens). Escrita. 201
// convidada, 200 se ela já tinha se candidatado à vaga.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { corpo, idDaRota } from "@/server/api/jobs";
import { apiRoute } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { inviteTalents } from "@/server/recruiting/talents";

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, "escrita", async (ctx) => {
    const candidato = await idDaRota(params);
    const b = await corpo(req);
    const vaga = z.uuid().safeParse(b.vaga_id);
    if (!vaga.success) throw new CamposInvalidos([{ campo: "vaga_id", codigo: "campo_invalido" }]);
    const r = await inviteTalents(ctx, { candidatos: [candidato], vaga: vaga.data });
    return Response.json({ convidado: r.convidados === 1, ja_candidato: r.pulados === 1 }, { status: r.convidados ? 201 : 200 });
  });
}
