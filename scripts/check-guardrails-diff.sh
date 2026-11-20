#!/bin/bash
# Passa os arquivos do repositório pelos hooks de PreToolUse de .claude/hooks/, como se cada um
# fosse escrito agora pelo Claude Code. Existe porque uma sessão aberta em outra pasta não dispara
# os hooks deste projeto (plans/8.1-fundacao.md); assim o `npm test` pega o que o hook teria barrado.
# Hooks de conteúdo (segredos, trilha, decisões, copy) olham todos os arquivos versionados ou novos;
# guard-migrations olha só migrations versionadas que mudaram desde o último commit.
# Uso: ./scripts/check-guardrails-diff.sh — código 0 se nenhum hook bloquear.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS="$ROOT/.claude/hooks"
export CLAUDE_PROJECT_DIR="$ROOT"
cd "$ROOT" || exit 1
falhas=0
total=0

# Roda um hook com o JSON de um Write do arquivo inteiro. Recebe: hook, caminho relativo.
roda() {
  local hook="$1" rel="$2" saida
  total=$((total + 1))
  saida=$(jq -n --arg p "$ROOT/$rel" --rawfile c "$ROOT/$rel" '{tool_name:"Write", tool_input:{file_path:$p, content:$c}}' \
    | "$HOOKS/$hook" 2>&1 >/dev/null)
  if [ $? -ne 0 ]; then
    echo "BLOQUEADO $hook: $rel"
    echo "  $saida"
    falhas=$((falhas + 1))
  fi
}

while IFS= read -r rel; do
  [ -f "$rel" ] || continue
  # Os dois scripts de guardrail contêm as violações de propósito, como casos de teste.
  case "$rel" in scripts/test-guardrails.sh|scripts/check-guardrails-diff.sh) continue ;; esac
  for hook in guard-secrets.sh guard-audit.sh guard-decisoes.sh guard-copy.sh; do roda "$hook" "$rel"; done
done < <(git ls-files --cached --others --exclude-standard -- src scripts)

while IFS= read -r rel; do
  [ -f "$rel" ] && roda guard-migrations.sh "$rel"
done < <(git diff --name-only HEAD -- supabase/migrations 2>/dev/null)

echo "guardrails no repositório: $((total - falhas)) de $total verificações ok"
[ "$falhas" -eq 0 ]
