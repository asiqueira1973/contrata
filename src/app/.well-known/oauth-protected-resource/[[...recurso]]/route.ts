// GET /.well-known/oauth-protected-resource (e /…/mcp) — RFC 9728 (6.4): o recurso e onde
// autorizar. Sem autenticação. Alguns clientes pedem primeiro a forma com o sufixo /mcp.
import { ESCOPOS } from "@/lib/limits";
import { corsHeaders, mcpResource, oauthJson, siteOrigin } from "@/server/oauth/server";

export function GET() {
  return oauthJson({
    resource: mcpResource(),
    authorization_servers: [siteOrigin()],
    bearer_methods_supported: ["header"],
    scopes_supported: [...ESCOPOS],
    resource_documentation: `${siteOrigin()}/docs/api`,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
