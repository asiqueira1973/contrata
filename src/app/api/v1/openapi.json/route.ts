// GET /api/v1/openapi.json — documento OpenAPI 3.1 (13.2). Público e com CORS aberto.
import { openApiDocument } from "@/server/api/openapi";

export function GET() {
  return Response.json(openApiDocument(), { headers: { "access-control-allow-origin": "*" } });
}
