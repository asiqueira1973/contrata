# Documentação técnica — Contrata

Descreve o que está **de fato** implementado, na ordem da seção 19 do `spec.md`. Toda mudança de schema, trigger, rota, ferramenta ou lógica de tela atualiza este documento no mesmo commit.

## Estado (20/11/2026)
Épico 8.0 concluído. Não há modelo de dados, rotas, ferramentas nem telas ainda; as seções abaixo são preenchidas a partir do épico 8.1.

## Guardrails (seção 18.1, Anexo B)
| Hook | Quando roda | O que barra |
|---|---|---|
| `guard-secrets.sh` | antes de Write/Edit | segredo ou import de `src/server/` em código que pode rodar no cliente |
| `guard-audit.sh` | idem | escrita direta em `rs_eventos` (só `rs_fn_registra_evento`, regra 11.6) |
| `guard-decisoes.sh` | idem | API v1, API pública e MCP confirmando decisão, encerrando candidatura ou mexendo em acesso (princípio 2, 11.7) |
| `guard-copy.sh` | idem | palavras de triagem automática em `copy.ts` e e-mails (15.3) |
| `guard-migrations.sh` | idem | edição de migration já versionada (7.6) |
| `guard-tests.sh` | idem, com `.claude/fix-mode` | edição de teste durante correção de bug (22.1) |
| `remind-advisors.sh` | depois de Write/Edit | lembra de aplicar a migration pelo MCP, rodar os advisors `rs_*` e regenerar o schema (7.6) |

Teste: `./scripts/test-guardrails.sh` (42 casos). O subagente `.claude/agents/verifier.md` confere cada épico contra o spec antes de ele ser declarado pronto.

## Divergências em relação ao spec
Nenhuma até aqui.
