// GET /api/v1/empresa — empresa (com a configuração, 8.9), nome da chave e escopos (13.2, escopo
// leitura). Escrever a configuração não tem porta na API (13.2): é pelo formulário do chat.
import type { NextRequest } from "next/server";
import { apiRoute, EmpresaV1 } from "@/server/api/v1";
import { companySettings } from "@/server/org/companies";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => {
    const e = await companySettings(ctx.empresa.id);
    return Response.json(EmpresaV1.parse({
      empresa: {
        id: ctx.empresa.id, slug: e.slug, nome: e.nome, descricao: e.descricao, site_url: e.site_url, email_contato: e.email_contato,
        cor_destaque: e.cor_destaque, logo_url: e.logo_url, pagina_publicada: e.pagina_publicada, retencao_dias: e.retencao_dias,
        talentos_meses: e.talentos_meses, mensagens_agente: e.mensagens_agente,
      },
      credencial: { nome: ctx.credencial.nome, escopos: ctx.escopos },
    }));
  });
}
