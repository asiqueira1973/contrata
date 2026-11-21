// [Público] POST /api/publico/{empresa}/vagas/{slug}/candidaturas (13.1; 9.2; 8.4). Cria a
// candidatura e devolve {id, upload_url?, concluir_token} (sem o link /c, que só vai por e-mail).
// Duplicada já recebida: 200 {duplicada: true} e o link de novo por e-mail (11.3). Guardião:
// requireEmpresaPublica + limites da 11.14 (429 ou 400 sem dizer o motivo). Chamada do próprio
// site é origem `pagina`; de outro site, `api_publica`.
import { copy } from "@/lib/copy";
import { comCors, corsDoPost } from "@/server/careers/api-publica";
import { requireEmpresaPublica } from "@/server/careers/public";
import { errorResponse, ipDaRequisicao, jsonError } from "@/server/http";
import { siteOrigin } from "@/server/oauth/server";
import { ATOR_CANDIDATO, applyToJob, empresaParaCandidatura } from "@/server/recruiting/applications";

type Ctx = { params: Promise<{ empresa: string; slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const cors = corsDoPost(req);
  const { empresa: slugEmpresa, slug } = await params;
  const publica = await requireEmpresaPublica(slugEmpresa);
  const empresa = publica ? await empresaParaCandidatura({ id: publica.id }) : null;
  if (!empresa) return comCors(jsonError("nao_encontrado", 404), cors);
  try {
    let corpo: unknown = null;
    try {
      corpo = await req.json();
    } catch {
      return comCors(jsonError("dados_invalidos", 400), cors);
    }
    const origem = req.headers.get("origin") === siteOrigin() ? "pagina" : "api_publica";
    const r = await applyToJob({ empresa, vaga: { slug }, entrada: corpo, origem, ip: ipDaRequisicao(req), ator: ATOR_CANDIDATO });
    if (r.duplicada) return comCors(Response.json({ id: r.id, duplicada: true, mensagem: copy.candidatura.duplicada }), cors);
    return comCors(Response.json({ id: r.id, upload_url: r.upload_url, concluir_token: r.concluir_token }, { status: 201 }), cors);
  } catch (e) {
    return comCors(errorResponse(e), cors);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsDoPost(req) });
}
