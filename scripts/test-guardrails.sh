#!/bin/bash
# Testa os hooks de .claude/hooks/ provocando cada violação e conferindo os casos que devem passar.
# Implementa o épico 8.0 (critérios de aceite) e a seção 18.1 do spec: hook que não bloqueia dá falsa segurança.
# Uso: ./scripts/test-guardrails.sh  — termina com código 0 só se todos os casos derem o resultado esperado.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS="$ROOT/.claude/hooks"
falhas=0
total=0

# Monta o JSON que o Claude Code entrega ao hook (PreToolUse/PostToolUse de Write|Edit).
# Recebe: caminho absoluto do arquivo, conteúdo. Devolve: JSON no stdout.
payload() {
  jq -n --arg p "$1" --arg c "$2" '{tool_name:"Write", tool_input:{file_path:$p, content:$c}}'
}

# Roda um hook e compara o código de saída com o esperado (0 = libera, 2 = bloqueia).
# Recebe: descrição, hook, código esperado, caminho, conteúdo; usa CLAUDE_PROJECT_DIR do ambiente.
caso() {
  local desc="$1" hook="$2" esperado="$3" caminho="$4" conteudo="$5"
  total=$((total + 1))
  payload "$caminho" "$conteudo" | "$HOOKS/$hook" >/dev/null 2>&1
  local obtido=$?
  if [ "$obtido" -eq "$esperado" ]; then
    echo "ok    $hook: $desc"
  else
    echo "FALHA $hook: $desc (esperado $esperado, obtido $obtido)"
    falhas=$((falhas + 1))
  fi
}

export CLAUDE_PROJECT_DIR="$ROOT"
P="$ROOT"

# --- guard-secrets (seções 18 e 20.3) ---
caso "service role em página pública" guard-secrets.sh 2 "$P/src/app/(publico)/x.tsx" 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY'
caso "segredo do Google na página de carreiras" guard-secrets.sh 2 "$P/src/app/[empresa]/page.tsx" 'process.env.GOOGLE_CLIENT_SECRET'
caso "segredo do S3 em src/lib" guard-secrets.sh 2 "$P/src/lib/x.ts" 'process.env.S3_SECRET_ACCESS_KEY'
caso "chave de acesso do S3 em componente" guard-secrets.sh 2 "$P/src/components/x.tsx" 'process.env.S3_ACCESS_KEY_ID'
caso "NEXT_PUBLIC com KEY" guard-secrets.sh 2 "$P/src/features/x/y.tsx" 'process.env.NEXT_PUBLIC_ALGUMA_KEY'
caso "componente de cliente importando src/server" guard-secrets.sh 2 "$P/src/features/x/y.tsx" $'"use client";\nimport { db } from "@/server/db";'
caso "service role em src/server (permitido)" guard-secrets.sh 0 "$P/src/server/db/client.ts" 'process.env.SUPABASE_SERVICE_ROLE_KEY'
caso "sessão na rota de aceite de convite (permitido)" guard-secrets.sh 0 "$P/src/app/convite/[token]/route.ts" 'process.env.SESSION_SECRET'
caso "componente comum (permitido)" guard-secrets.sh 0 "$P/src/components/nav/Menu.tsx" 'export function Menu() {}'

# --- guard-audit (regra 11.6) ---
caso "update em rs_eventos" guard-audit.sh 2 "$P/src/server/x.ts" "await db.from('rs_eventos').update({ dados: {} })"
caso "delete em rs_eventos" guard-audit.sh 2 "$P/src/server/x.ts" 'await db.from("rs_eventos").delete()'
caso "insert direto em rs_eventos" guard-audit.sh 2 "$P/src/server/x.ts" "db.from('rs_eventos').insert({})"
caso "update quebrado em duas linhas (Prettier)" guard-audit.sh 2 "$P/src/server/x.ts" $'await db\n  .from(\'rs_eventos\')\n  .update({ dados: {} })'
caso "registro pela função (permitido)" guard-audit.sh 0 "$P/src/server/audit/record.ts" "await db.rpc('rs_fn_registra_evento', {})"
caso "leitura da trilha (permitido)" guard-audit.sh 0 "$P/src/server/x.ts" "db.from('rs_eventos').select('*')"

# --- guard-decisoes (princípio 2, regras 11.7 e 13.2) ---
caso "API v1 confirmando decisão" guard-decisoes.sh 2 "$P/src/app/api/v1/decisoes/route.ts" "await db.rpc('rs_fn_confirma_decisao', {})"
caso "MCP encerrando candidatura direto" guard-decisoes.sh 2 "$P/src/server/mcp/tools/reprovar.ts" 'await closeApplication(id, ator)'
caso "API pública encerrando candidatura" guard-decisoes.sh 2 "$P/src/app/api/publico/x/route.ts" "db.rpc('rs_fn_encerra_candidatura', {})"
caso "rota do MCP mudando acesso de membro" guard-decisoes.sh 2 "$P/src/app/mcp/route.ts" "db.rpc('rs_fn_muda_acesso', {})"
caso "API v1 convidando membro" guard-decisoes.sh 2 "$P/src/app/api/v1/membros/route.ts" "db.rpc('rs_fn_convida_membro', {})"
caso "chamada quebrada em linhas no MCP" guard-decisoes.sh 2 "$P/src/server/mcp/tools/x.ts" $'await db\n  .rpc(\n    "rs_fn_confirma_decisao",\n    {})'
caso "API v1 criando proposta (permitido)" guard-decisoes.sh 0 "$P/src/app/api/v1/candidaturas/[id]/reprovar/route.ts" 'return proposeDecision(ator, alcance, dados)'
caso "rota de confirmação do painel (permitido)" guard-decisoes.sh 0 "$P/src/app/api/painel/[empresa]/decisoes/confirmar/route.ts" 'await confirmDecision(ids, membro)'
caso "domínio encerrando candidatura (permitido)" guard-decisoes.sh 0 "$P/src/server/recruiting/applications.ts" "db.rpc('rs_fn_encerra_candidatura', {})"
caso "save.ts de formulário confirmando decisão (permitido, v0.4)" guard-decisoes.sh 0 "$P/src/server/mcp/forms/decisoes/save.ts" 'await confirmDecision(ids, ctx)'
caso "abrir_formulario (index.ts) confirmando decisão" guard-decisoes.sh 2 "$P/src/server/mcp/forms/decisoes/index.ts" 'await confirmDecision(ids, ctx)'
caso "fallback do formulário confirmando decisão" guard-decisoes.sh 2 "$P/src/server/mcp/forms/decisoes/fallback.ts" "db.rpc('rs_fn_confirma_decisao', {})"
caso "save.ts fora de forms/ não é exceção" guard-decisoes.sh 2 "$P/src/server/mcp/save.ts" 'await confirmDecision(ids, ctx)'

# --- guard-copy (princípio 2, seção 15.3) ---
caso "algoritmo no copy.ts" guard-copy.sh 2 "$P/src/lib/copy.ts" 'export const copy = { x: "Nosso algoritmo analisa você" }'
caso "pontuação com acento" guard-copy.sh 2 "$P/src/lib/copy.ts" 'export const copy = { x: "Sua pontuação foi 7" }'
caso "score como palavra" guard-copy.sh 2 "$P/src/lib/copy.ts" 'export const copy = { x: "Veja o score da candidatura" }'
caso "match como palavra" guard-copy.sh 2 "$P/src/lib/copy.ts" 'export const copy = { x: "Deu match com a vaga" }'
caso "eliminatória em e-mail" guard-copy.sh 2 "$P/src/server/email/devolutiva.ts" 'Você não passou na etapa eliminatória'
caso "eliminada em e-mail" guard-copy.sh 2 "$P/src/server/email/x.ts" 'Sua candidatura foi eliminada'
caso "fit cultural na descrição de ferramenta MCP" guard-copy.sh 2 "$P/src/lib/copy.ts" 'export const mcp = { d: "Avalia o fit cultural" }'
caso "scores dentro de outra palavra não é score (permitido)" guard-copy.sh 0 "$P/src/lib/copy.ts" 'export const copy = { x: "Underscored" }'
caso "copy comum (permitido)" guard-copy.sh 0 "$P/src/lib/copy.ts" 'export const copy = { titulo: "Uma pessoa da empresa analisa e decide." }'
caso "match em código fora da copy (permitido)" guard-copy.sh 0 "$P/src/server/x.ts" 'const m = s.match(/x/)'

# --- guard-migrations e guard-tests precisam de um repositório git próprio ---
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q
mkdir -p "$TMP/supabase/migrations" "$TMP/.claude" "$TMP/src/server"
echo "select 1;" > "$TMP/supabase/migrations/20261120000000_rs_inicio.sql"
git -C "$TMP" add -A && git -C "$TMP" -c user.email=t@t -c user.name=t commit -q -m inicio
export CLAUDE_PROJECT_DIR="$TMP"

# --- guard-migrations (seção 7.6) ---
caso "editar migration versionada" guard-migrations.sh 2 "$TMP/supabase/migrations/20261120000000_rs_inicio.sql" 'select 2;'
caso "migration nova (permitido)" guard-migrations.sh 0 "$TMP/supabase/migrations/20261121000000_rs_nova.sql" 'select 2;'

# --- guard-tests (seção 22.1) ---
caso "teste editado sem fix-mode (permitido)" guard-tests.sh 0 "$TMP/src/server/x.test.ts" 'it("a", () => {})'
touch "$TMP/.claude/fix-mode"
caso "teste editado com fix-mode" guard-tests.sh 2 "$TMP/src/server/x.test.ts" 'it("a", () => {})'
caso "pgTAP editado com fix-mode" guard-tests.sh 2 "$TMP/supabase/tests/rls.sql" 'select plan(1);'
caso "código editado com fix-mode (permitido)" guard-tests.sh 0 "$TMP/src/server/x.ts" 'export const a = 1'

# --- remind-advisors (seções 7.6 e 20.3) ---
caso "migration escrita dispara o lembrete" remind-advisors.sh 2 "$TMP/supabase/migrations/20261121000000_rs_nova.sql" 'select 2;'
caso "arquivo comum não dispara" remind-advisors.sh 0 "$TMP/src/server/x.ts" 'export const a = 1'

echo
echo "$((total - falhas)) de $total casos ok"
[ "$falhas" -eq 0 ]
