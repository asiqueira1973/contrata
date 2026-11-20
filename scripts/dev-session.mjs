// Só desenvolvimento: imprime um cookie de sessão (rs_sessao) para um usuário do banco local,
// para conferir telas sem o cliente OAuth do Google (seção 22, testes manuais). Recusa rodar
// contra um banco que não seja o local.
// Uso: node scripts/dev-session.mjs carla@padaria.exemplo
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.SUPABASE_URL ?? "")) {
  console.error("dev-session: SUPABASE_URL não é local; recusado.");
  process.exit(1);
}
const email = process.argv[2];
const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rs_usuarios?select=id&email=eq.${encodeURIComponent(email)}`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
const [u] = await res.json();
if (!u) {
  console.error("dev-session: usuário não encontrado no banco local.");
  process.exit(1);
}
const iat = Math.floor(Date.now() / 1000);
const jwt = await new SignJWT({ usuario_id: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(iat).setExpirationTime(iat + 86400)
  .sign(new TextEncoder().encode(env.SESSION_SECRET));
console.log(`rs_sessao=${jwt}`);
