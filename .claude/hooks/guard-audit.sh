#!/bin/bash
# A trilha de eventos só aceita inserção pela função rs_fn_registra_evento (regra 11.6, seção 18.1).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$path" in
  */src/*|*/scripts/*) ;;
  *) exit 0 ;;
esac
# Junta as linhas: o Prettier quebra .from(...) e .update( em linhas separadas.
flat=$(echo "$content" | tr "\n" " ")
if echo "$flat" | grep -qE "from\(['\"]rs_eventos['\"]\)[[:space:]]*\.(insert|update|upsert|delete)"; then
  echo "Bloqueado: escrita direta em rs_eventos (regra 11.6). Registre eventos só com rpc('rs_fn_registra_evento', …) dentro da mesma transação da mudança de estado; eventos nunca se alteram nem se apagam." >&2
  exit 2
fi
exit 0
