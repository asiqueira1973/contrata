// GET /api/v1/pessoas — pessoas da empresa com nome, e-mail, cargo, área e tem_acesso, sem papel
// (13.2, escopo leitura), paginadas por cursor.
import type { NextRequest } from "next/server";
import { PessoaV1, apiRoute, pagina, paginar } from "@/server/api/v1";
import { listPeople } from "@/server/org/people";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const pessoas = (await listPeople(ctx.empresa.id)).map((p) =>
      PessoaV1.parse({ id: p.id, nome: p.nome, email: p.email, cargo: p.cargo, area: p.area, tem_acesso: !!p.acesso && !p.acesso.pendente }),
    );
    return Response.json(paginar(pessoas, pagina(req)));
  });
}
