#!/bin/bash
# Princípio 2 e regra 11.7 (v0.4): API v1, API pública e as ferramentas do MCP visíveis ao modelo nunca
# confirmam decisões, nem encerram candidaturas direto, nem mexem em acessos. Só os save.ts dos
# formulários (src/server/mcp/forms/<acao>/save.ts, ferramentas visibility ["app"]) fazem isso.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$path" in
  */src/server/mcp/forms/*/save.ts) exit 0 ;;
  */src/app/api/v1/*|*/src/app/api/publico/*|*/src/app/mcp/*|*/src/server/mcp/*) ;;
  *) exit 0 ;;
esac
flat=$(echo "$content" | tr "\n" " ")
if echo "$flat" | grep -qE "rs_fn_confirma_decisao|confirmDecision|confirmarDecisao|rs_fn_encerra_candidatura|closeApplication|encerraCandidatura|rs_fn_muda_acesso|rs_fn_convida_membro|rs_fn_da_acesso"; then
  echo "Bloqueado: API e MCP não confirmam decisões, não encerram candidaturas direto e não mexem em acessos (princípio 2, regras 11.7 e 13.2). Use proposeDecision() em src/server/recruiting/decisions; confirmar e mexer em acesso só no save.ts de um formulário (src/server/mcp/forms/<acao>/save.ts)." >&2
  exit 2
fi
exit 0
