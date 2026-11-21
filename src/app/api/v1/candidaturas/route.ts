// /api/v1/candidaturas (8.4, 8.5; 13.2). GET (leitura): lista com os filtros vaga_id, etapa_id,
// situacao (padrão ativa; todas), sinalizada, parada_desde, q (busca, 11.28), atualizada_desde e
// ordem, por cursor. POST (escrita): cria a candidatura de uma vaga publicada da
// empresa (origem `integracao`), com o mesmo schema da 11.2 e `vaga_id` no corpo. Devolve
// {id, upload_url?, concluir_token}, como a API pública; o link /c só vai por e-mail ao candidato.
// Duplicada já recebida: 200 {id, duplicada: true} (11.3). Sem limite por IP (a chave já identifica).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { corpo } from "@/server/api/jobs";
import { filtrosDaQuery } from "@/server/api/applications";
import { ListaCandidaturas, apiRoute, pagina, proximoCursor } from "@/server/api/v1";
import { CamposInvalidos, DomainError } from "@/server/http";
import { applyToJob, empresaParaCandidatura } from "@/server/recruiting/applications";
import { getJob } from "@/server/recruiting/jobs";
import { listApplications } from "@/server/recruiting/pipeline";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const filtros = filtrosDaQuery(req.nextUrl.searchParams);
    const p = pagina(req);
    const r = await listApplications(ctx, filtros, p);
    return Response.json(ListaCandidaturas.parse({ itens: r.itens, proximo_cursor: proximoCursor(p.inicio, p.limite, r.mais) }));
  });
}

export function POST(req: NextRequest) {
  return apiRoute(req, "escrita", async (ctx) => {
    const { vaga_id, ...entrada } = await corpo(req);
    const id = z.uuid().safeParse(vaga_id);
    if (!id.success) throw new CamposInvalidos([{ campo: "vaga_id", codigo: "campo_invalido" }]);
    // getJob confere que a vaga é desta empresa (404 se não for).
    const vaga = await getJob(ctx, id.data);
    const empresa = await empresaParaCandidatura({ id: ctx.empresa.id });
    if (!empresa) throw new DomainError("nao_encontrado", 404);
    const r = await applyToJob({ empresa, vaga: { id: vaga.id }, entrada, origem: "integracao", ip: null, ator: ctx.ator });
    if (r.duplicada) return Response.json({ id: r.id, duplicada: true });
    return Response.json({ id: r.id, upload_url: r.upload_url, concluir_token: r.concluir_token }, { status: 201 });
  });
}
