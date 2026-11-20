#!/bin/bash
# Bloqueia segredo ou import de src/server/ em código que pode rodar no cliente.
# Implementa as seções 18 e 20.3: segredo só existe no servidor.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Rodam só no servidor: rotas de API, MCP, OAuth, aceite de convite, src/server, scripts e o proxy (seção 18).
case "$path" in
  */src/app/api/*|*/src/app/mcp/*|*/src/app/oauth/*|*/src/app/.well-known/*|*/src/app/sair/*|*/src/app/convite/*|*/src/server/*|*/scripts/*|*/src/proxy.ts) exit 0 ;;
  */src/app/*|*/src/components/*|*/src/features/*|*/src/lib/*) ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -qE 'SUPABASE_SERVICE_ROLE_KEY|service_role|GOOGLE_CLIENT_SECRET|SESSION_SECRET|CHAVES_ENC_KEY|RESEND_API_KEY|CRON_SECRET|VISAO_API_KEY|S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID|NEXT_PUBLIC_[A-Z_]*(SECRET|KEY)'; then
  echo "Bloqueado: segredo em código que pode rodar no cliente (seções 18 e 20.3). Leia o segredo só em src/server/ ou numa rota de src/app/api/ e chame essa rota do cliente." >&2
  exit 2
fi
if echo "$content" | grep -q "use client" && echo "$content" | grep -qE "from ['\"]@/server/|from ['\"](\.\./)+server/"; then
  echo "Bloqueado: componente de cliente importando src/server/ (seção 20.3). Exponha o dado por uma rota ou passe por props de um Server Component." >&2
  exit 2
fi
exit 0
