// /api/v1/vagas (8.3; 13.2). GET (leitura): lista com filtros status, area_id, dono_pessoa_id e
// atualizada_desde, por cursor. POST (escrita): cria a vaga em rascunho (11.1, mesmo schema do
// formulário); sem etapas, as etapas padrão; Idempotency-Key repetida devolve 200 com a mesma vaga.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { STATUS_VAGA } from "@/lib/limits";
import { chaveIdempotencia, corpo, vagaV1 } from "@/server/api/jobs";
import { ListaVagas, apiRoute, pagina, proximoCursor } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { createJob, etapasPadrao, getJob, listJobs, validarVaga, type FiltrosVagas } from "@/server/recruiting/jobs";

const filtrosSchema = z.object({
  status: z.enum(STATUS_VAGA).optional(),
  area_id: z.uuid().optional(),
  dono_pessoa_id: z.uuid().optional(),
  atualizada_desde: z.iso.datetime({ offset: true }).optional(),
});

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const sp = Object.fromEntries([...req.nextUrl.searchParams].filter(([k]) => k in filtrosSchema.shape));
    const f = filtrosSchema.safeParse(sp);
    if (!f.success) throw new CamposInvalidos(f.error.issues.map((i) => ({ campo: String(i.path[0]), codigo: "campo_invalido" })));
    const p = pagina(req);
    const r = await listJobs(ctx, f.data as FiltrosVagas, p);
    return Response.json(ListaVagas.parse({
      itens: r.itens.map((v) => ({
        id: v.id, slug: v.slug, titulo: v.titulo, status: v.status, area_id: v.area?.id ?? null, dono_pessoa_id: v.dono?.id ?? null,
        modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf, publicada_em: v.publicada_em, encerra_em: v.encerra_em,
        atualizado_em: v.atualizado_em, candidaturas_ativas: v.candidaturas_ativas,
      })),
      proximo_cursor: proximoCursor(p.inicio, p.limite, r.mais),
    }));
  });
}

export function POST(req: NextRequest) {
  return apiRoute(req, "escrita", async (ctx) => {
    const chave = chaveIdempotencia(req);
    const body = await corpo(req);
    const dados = validarVaga({ ...body, etapas: body.etapas ?? etapasPadrao() });
    const { id, criada } = await createJob(ctx, dados, chave);
    return Response.json(vagaV1(await getJob(ctx, id)), { status: criada ? 201 : 200 });
  });
}
