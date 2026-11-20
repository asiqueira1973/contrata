// GET /.well-known/oauth-authorization-server — RFC 8414 (6.4): endpoints, só PKCE S256, só
// authorization_code, cliente público, e os escopos do Contrata (6.3). URLs de NEXT_PUBLIC_SITE_URL.
import { ESCOPOS } from "@/lib/limits";
import { corsHeaders, oauthJson, siteOrigin } from "@/server/oauth/server";

export function GET() {
  const base = siteOrigin();
  return oauthJson({
    issuer: base,
    authorization_endpoint: `${base}/oauth/autorizar`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/registrar`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...ESCOPOS],
    service_documentation: `${base}/docs/api`,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
