# Prompt de implementação — Contrata (colar no Claude Code, a partir de `~/contrata`)

```
Você vai implementar o Contrata (nome de trabalho), um ATS de código aberto e gratuito, só de recrutamento e seleção, para várias empresas, a partir do spec.md (v0.2) que está na raiz deste repositório. O spec é a fonte única de verdade: não invente regra, número, texto ou tabela que não esteja nele.

Antes de qualquer código:
1. Leia o spec.md inteiro. Leia também, no repositório de referência ~/assina (GitHub asiqueira1973/assina), o CLAUDE.md, o .claude/, o src/app/globals.css, src/server/db, src/server/auth, src/app/mcp, src/app/oauth e src/server/webhooks: o padrão técnico e visual vem de lá (seção 4 e Anexo B). Reaproveite, não reescreva do zero.
2. Revise comigo a seção 24 (Assunções) e as perguntas abertas da seção 25. Diante de qualquer item da seção 25, pare e pergunte.
3. Faça o épico 8.0: instale os guardrails do Anexo B (adaptados do ~/assina) e teste cada hook uma vez.

Regras que não se quebram:
- Princípio 1: cada ação nasce como função de domínio em src/server/, depois rota da API v1, depois ferramenta MCP, depois tela. Se não tiver porta de API/MCP, está na lista "sem porta" da seção 13.2.
- Princípio 2 e regra 11.7: API e MCP nunca reprovam, contratam ou encerram vaga com candidatos ativos; criam proposta. Só um membro recrutador ou administrador, com sessão no painel, confirma. Nenhuma credencial confirma.
- Regra 11.5: nenhuma candidatura é encerrada sem devolutiva enviada na mesma transação.
- Login de membros só pelo Google (seção 6.1). Candidato nunca tem conta.
- Alcance (11.32): administrador vê tudo; recrutador as áreas dele (ou todas); avaliador só a equipe da vaga. Toda consulta filtra por empresa_id e pelo alcance; o vínculo é relido a cada requisição.
- Banco em português, snake_case, prefixo rs_, no projeto Supabase compartilhado jeesdmfcrmhyufwzwzwt. Migrations pelo MCP apply_migration (local e remoto, mesmo SQL), nunca db push. Advisors filtrados a rs_* depois de cada DDL.
- Toda rotina comentada em português com a regra que implementa. Copy só em src/lib/copy.ts (inclusive descrições das ferramentas MCP); números só em src/lib/limits.ts.
- Nenhum dado pessoal em log, evento, analytics ou corpo de erro.

Como trabalhar, épico por épico, na ordem da seção 8 (8.0 a 8.12):
- Entre em plan mode, mostre o plano (arquivos, ordem, testes, portas afetadas) e salve em plans/<épico>.md depois que eu aprovar.
- Implemente, rode npm run verify e cole a saída.
- Acione o subagente verifier e só declare pronto com PRONTO e sem "não cumprido".
- Atualize DOCUMENTACAO-TECNICA.md, CLAUDE.md e README.md no mesmo commit.
- Para as telas, siga a seção 16 e o design aprovado no Claude Design (prompt-design-contrata.md); confira por screenshot em claro e escuro, 375 px e 1280 px.

Comece pela leitura e pelo épico 8.0.
```
