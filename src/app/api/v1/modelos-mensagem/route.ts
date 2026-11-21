// GET /api/v1/modelos-mensagem (8.6; 13.2, 11.29): os modelos padrão com o que a empresa
// personalizou, mais os modelos novos dela. Leitura.
import type { NextRequest } from "next/server";
import { apiRoute } from "@/server/api/v1";
import { listTemplates } from "@/server/messages/templates";

export function GET(req: NextRequest) {
  return apiRoute(req, "leitura", async (ctx) => Response.json({ itens: await listTemplates(ctx.empresa.id) }));
}
