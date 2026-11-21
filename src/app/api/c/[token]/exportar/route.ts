// GET /api/c/{token}/exportar — "Baixar meus dados" (11.13, 14.2): o JSON como download, na hora.
// Guardião: o token. Sem cache e sem referrer (seção 17).
import { errorResponse } from "@/server/http";
import { exportData } from "@/server/recruiting/applications";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const r = await exportData((await params).token);
    return new Response(JSON.stringify(r.conteudo, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${r.arquivo}"`,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
