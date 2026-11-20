// Ambiente dos testes Vitest (seção 22): aponta para o Supabase local do Contrata (portas 557xx)
// e define segredos descartáveis. A chave de serviço local é lida do `supabase status`.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

function localSupabaseEnv(): Record<string, string> {
  try {
    const out = execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return Object.fromEntries(
      out.split("\n").map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
    );
  } catch {
    return {};
  }
}

const local = localSupabaseEnv();
process.env.SUPABASE_URL = local.API_URL ?? "http://127.0.0.1:55721";
process.env.SUPABASE_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY ?? "";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3050";
process.env.GOOGLE_CLIENT_ID = "client-teste.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "segredo-teste";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
// Regra 11.33: só o domínio dos testes cria empresa; os testes de permissão trocam e restauram.
process.env.CRIACAO_EMPRESA_EMAILS = "@criador.test";
process.env.EMAILS_BLOQUEADOS = "bloqueado@teste.dev";
// E-mail: os testes nunca falam com o Resend (o .env.local de quem desenvolve pode ter a chave).
delete process.env.RESEND_API_KEY;

// Espera o Supabase local responder antes dos testes (até 60 s).
async function waitForLocalSupabase(timeoutMs = 60000): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rs_usuarios?select=id&limit=1`, {
        headers: { apikey: key, authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) return;
    } catch {
      // tenta de novo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

await waitForLocalSupabase();
