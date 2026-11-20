// POST /oauth/registrar — RFC 7591 (6.4): registro dinâmico de cliente público (sem segredo).
// redirect_uris: 1 a 5, só https ou http em localhost/127.0.0.1. Resposta 201 com o client_id.
import { z } from "zod";
import { copy } from "@/lib/copy";
import { OAUTH_CLIENTE_NOME_MAX, OAUTH_REDIRECT_URIS_MAX } from "@/lib/limits";
import { acceptableRedirectUri, corsHeaders, oauthError, oauthJson, registerClient } from "@/server/oauth/server";

const Body = z.object({
  redirect_uris: z.array(z.string()).min(1).max(OAUTH_REDIRECT_URIS_MAX),
  client_name: z.string().trim().min(1).max(OAUTH_CLIENTE_NOME_MAX).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return oauthError("invalid_client_metadata", copy.oauthErros.registroCorpo);
  if (!parsed.data.redirect_uris.every(acceptableRedirectUri)) return oauthError("invalid_redirect_uri", copy.oauthErros.registroUri);
  const client = await registerClient(parsed.data.client_name ?? "Cliente MCP", parsed.data.redirect_uris);
  return oauthJson(
    {
      client_id: client.id,
      client_name: client.nome,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    201,
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
