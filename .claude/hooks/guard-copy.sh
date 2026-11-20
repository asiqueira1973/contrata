#!/bin/bash
# Impede copy que sugere triagem automática (princípio 2, seção 15.3).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$path" in
  */src/lib/copy.ts|*/src/server/email/*) ;;
  *) exit 0 ;;
esac
# Só arquivos de texto: em .tsx e código comum, palavras como "match" aparecem como API (str.match) e dariam falso positivo.
# Por isso toda copy, inclusive as descrições das ferramentas MCP, vive em copy.ts (seção 18).
if echo "$content" | grep -qiE 'intelig(ê|e)ncia artificial reprovou|algoritmo|pontua(ç|c)(ã|a)o|\bscore\b|ranking|fit cultural|\bmatch\b|eliminad[oa]|eliminat(ó|o)ria'; then
  echo "Bloqueado: copy sugere triagem automática, que o produto não faz (princípio 2, seção 15.3). Reescreva dizendo o que acontece de fato: uma pessoa da empresa analisa e decide." >&2
  exit 2
fi
exit 0
