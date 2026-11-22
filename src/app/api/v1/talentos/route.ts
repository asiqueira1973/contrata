// GET /api/v1/talentos (8.7; 13.2): o banco de talentos da empresa (só quem consentiu e está no
// prazo), com q (texto) e vaga_id (vaga anterior), por cursor. Leitura.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute, pagina, proximoCursor } from "@/server/api/v1";
import { CamposInvalidos } from "@/server/http";
import { searchTalents } from "@/server/recruiting/talents";

const filtros = z.object({ q: z.string().trim().min(1).max(200).optional(), vaga_id: z.uuid().optional() });

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const sp = req.nextUrl.searchParams;
    const f = filtros.safeParse({ q: sp.get("q") ?? undefined, vaga_id: sp.get("vaga_id") ?? undefined });
    if (!f.success) throw new CamposInvalidos(f.error.issues.map((i) => ({ campo: String(i.path[0]), codigo: "campo_invalido" })));
    const p = pagina(req);
    const r = await searchTalents(ctx, { ...(f.data.q ? { q: f.data.q } : {}), ...(f.data.vaga_id ? { vaga_anterior: f.data.vaga_id } : {}) }, p);
    return Response.json({ itens: r.itens, proximo_cursor: proximoCursor(p.inicio, p.limite, r.mais) });
  });
}
