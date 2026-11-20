#!/bin/bash
# Depois de escrever uma migration, lembra de aplicar pelo MCP, rodar os advisors e regenerar o schema (seções 7.6 e 20.3).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*)
    echo "Migration escrita. Aplique no local e no remoto (MCP apply_migration, mesmo SQL; nunca db push no projeto compartilhado), rode get_advisors (security e performance) filtrando objetos rs_*, resolva alertas críticos e regenere supabase/schema.sql filtrado a rs_ (seções 7.6 e 20.3)." >&2
    exit 2 ;;
esac
exit 0
