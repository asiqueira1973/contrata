# Contrata

Sistema de recrutamento e seleção (ATS) de código aberto e gratuito, para várias empresas, com API REST e servidor MCP como portas principais de quem recruta. "Contrata" é nome de trabalho (spec, pergunta 25.1). Licença MIT.

A especificação completa está em [`spec.md`](spec.md); os planos de cada épico, em [`plans/`](plans/).

## Estado
Em implementação. Épico 8.0 (guardrails do Claude Code) concluído; ainda não há aplicação para rodar. O guia de auto-hospedagem entra no épico 8.12.

## Para quem contribui
- `./scripts/test-guardrails.sh` testa os hooks de `.claude/hooks/` (precisa de `jq`).
- As regras de código e as pegadinhas estão em [`CLAUDE.md`](CLAUDE.md); as instruções de revisão, em [`REVIEW.md`](REVIEW.md).
