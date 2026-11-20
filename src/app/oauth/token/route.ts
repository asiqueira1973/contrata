// POST /oauth/token — 6.4: troca o código pelo token rsm_…, conferindo numa transação código
// existente, não usado, não vencido, do mesmo cliente, mesmo redirect_uri, PKCE S256 e membro
// ainda ativo. Aceita form-urlencoded ou JSON. Resposta {access_token, token_type: "Bearer"}.
import { copy } from "@/lib/copy";
import { PKCE_VERIFIER_MAX, PKCE_VERIFIER_MIN } from "@/lib/limits";
import { errorCode } from "@/server/error-code";
import { corsHeaders, exchangeCode, findClient, oauthError, oauthJson } from "@/server/oauth/server";

// Lê os campos do corpo; corpo que não é objeto vira "sem campos" (invalid_request, não 500).
async function fields(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  }
  const form = await req.formData().catch(() => null);
  return form ? Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])) : {};
}

const VERIFIER = new RegExp(`^[A-Za-z0-9\\-._~]{${PKCE_VERIFIER_MIN},${PKCE_VERIFIER_MAX}}$`);

export async function POST(req: Request) {
  const f = await fields(req);
  const e = copy.oauthErros;
  if (f.grant_type !== "authorization_code") return oauthError("unsupported_grant_type", e.grantType);
  if (!f.code || !f.client_id || !f.redirect_uri || !VERIFIER.test(f.code_verifier ?? "")) return oauthError("invalid_request", e.faltando);
  try {
    if (!(await findClient(f.client_id))) return oauthError("invalid_client", e.cliente, 401);
    const token = await exchangeCode(f.code, f.client_id, f.redirect_uri, f.code_verifier);
    if (!token) return oauthError("invalid_grant", e.grant);
    return oauthJson({ access_token: token, token_type: "Bearer" });
  } catch (err) {
    console.error("erro_interno_oauth", errorCode(err));
    return oauthError("server_error", e.servidor, 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
