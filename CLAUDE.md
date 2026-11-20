# CLAUDE.md — Contrata

Fonte única de verdade: `spec.md` (v0.2). Planos aprovados: `plans/`. Os princípios da seção 0 desempatam dúvidas. Itens da seção 25 → **pare e pergunte**. Referência técnica e visual: `~/assina` (leia antes de reinventar login, R2, Resend, webhooks, MCP e OAuth). Mudou schema, rota, ferramenta ou tela → atualize `DOCUMENTACAO-TECNICA.md`, este arquivo e o README no mesmo commit.

## Regra de ouro
Se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.
Bug: teste que reproduz → ver falhar → commit → `touch .claude/fix-mode` → corrigir → `rm .claude/fix-mode`.

## Estado
Spec v0.3 (**clone e use**, não SaaS: sem pedido de convite; quem cria empresa é `CRIACAO_EMPRESA_EMAILS`, 11.33). Épicos 8.0 e 8.1 concluídos no local (20/11/2026). Pendentes do 8.1, com o Alexandre: migrations no remoto, cliente OAuth do Google (`plans/8.1-fundacao.md`). Próximo: 8.2 (credenciais, API v1 e MCP), em plan mode. 25.1 (nome e domínio) decide-se antes do 8.12.

## Regras que não se quebram
- **Princípio 1:** cada ação nasce como função de domínio em `src/server/`, depois rota da API v1, depois ferramenta MCP, depois tela. Sem porta → está na lista "sem porta" da seção 13.2.
- **Princípio 2 / regra 11.7:** API e MCP nunca reprovam, contratam nem encerram vaga com candidatos ativos: criam proposta. Só membro recrutador ou administrador, com sessão no painel, confirma. Nenhuma credencial confirma.
- **Regra 11.5:** nenhuma candidatura sai de `ativa` para `reprovada`/`encerrada_vaga` sem devolutiva enviada na mesma transação.
- Login de membros só pelo Google (6.1). Candidato nunca tem conta.
- **Alcance (11.32):** administrador tudo; recrutador as áreas dele (ou todas); avaliador só a equipe da vaga. Toda consulta filtra por `empresa_id` e alcance; o vínculo é relido a cada requisição.

## Convenções (seção 18)
- Banco em português `snake_case`, **sempre com prefixo `rs_`** (projeto Supabase compartilhado `jeesdmfcrmhyufwzwzwt`). Código, variáveis e arquivos em inglês; fronteira em `src/server/db/`.
- Cabeçalho em português em toda função, rota, ferramenta MCP, trigger e função SQL: o que faz, recebe, devolve e a regra (`// Implementa a regra 11.7: pela API, reprovar vira proposta`).
- Segredos só em `src/server/`, `src/app/api/`, `src/app/mcp/`, `src/app/oauth/`, `src/app/.well-known/`, `src/app/sair/`, `src/app/convite/` e `scripts/`. Todo arquivo de `src/server/` começa com `import "server-only"`.
- Copy só em `src/lib/copy.ts` (inclusive descrições das ferramentas MCP e do OpenAPI); números só em `src/lib/limits.ts`, com o número da regra.
- Toda escrita de domínio recebe `ator: Ator` (sem padrão); toda leitura de candidaturas recebe `alcance: Alcance`.
- Nenhum dado pessoal em log, evento, webhook de erro, analytics ou corpo de erro.

## Comandos
- `npm run verify`: typecheck, lint, `test` (guardrails 42/42 + varredura do repositório pelos hooks + pgTAP + Vitest), build e `npm audit`. Saída saudável: `42 de 42 casos ok`, `N de N verificações ok`, `Result: PASS`, `Tests N passed`, tabela de rotas, `found 0 vulnerabilities`.
- `npm run dev` em `http://localhost:3050` · `supabase start` (portas **557xx**; o seed cria a Padaria Exemplo) · `npm run db:types` · `npm run db:schema`.
- Sem cliente Google, em dev: `node scripts/dev-session.mjs carla@padaria.exemplo` imprime um cookie de sessão de um usuário do seed.

## Pegadinhas
- Remoto compartilhado: migrations pelo MCP `apply_migration` (mesmo SQL do arquivo, local e remoto), **nunca** `supabase db push`; advisors filtrados a `rs_*`; regenerar `supabase/schema.sql` filtrado a `rs_` no mesmo commit.
- Service role ignora RLS: toda consulta filtra por `empresa_id` (e alcance) ou por `token_hash`.
- Trilha (`rs_eventos`) só por `rpc('rs_fn_registra_evento')`. O hook bloqueia escrita direta.
- `guard-decisoes` barra em `src/app/api/v1/`, `src/app/api/publico/`, `src/app/mcp/` e `src/server/mcp/` qualquer menção a confirmar decisão, encerrar candidatura ou mexer em acesso — inclusive em comentário. Nesses arquivos, chame `proposeDecision()` e não cite os nomes proibidos.
- `guard-copy` lê `copy.ts` e `src/server/email/` inteiros, comentários inclusive: "algoritmo", "score", "match", "ranking", "eliminado/a", "eliminatória", "pontuação", "fit cultural" não entram nem em comentário.
- Regex com acento em hook: o grep do macOS compara byte a byte dentro de `[...]`. Use alternância `(a|á)`, nunca `[aá]`.
- Hook novo ou alterado → acrescente casos em `scripts/test-guardrails.sh` e atualize o Anexo B do spec no mesmo commit.
- Nunca logar nome, e-mail, telefone, texto de currículo, resposta, nota, avaliação, devolutiva, token ou URL `/c/…`.
- **E-mail é `citext`, mas com `search_path = ''` o `=` vira o de `text`** e diferencia maiúsculas. Em função SQL, compare e-mail com `operator(extensions.=)`.
- Toda página ou layout que lê a sessão leva `export const instant = false`, **inclusive fora de `/painel`** (ex.: `/convite`). O opt-out vale por segmento.
- O Next 16 mantém cópias escondidas no DOM: `get_page_text` e `querySelector` podem ler o fallback ("Carregando…") enquanto a tela mostra o conteúdo. Confira por screenshot.
- Vitest 5.1.1: um `vi.fn` que rejeita é dado como falha do teste mesmo quando a rota trata o erro. Para simular erro de dependência, use uma função comum controlada por variável (ver o teste do callback). Fixar `vitest@5.1.0` quebra o `npm install` (bug do arborist com o peer opcional `@vitest/browser-playwright`).
- Esta pasta pode ser editada de uma sessão aberta em outro projeto, onde os hooks daqui não disparam: o `npm test` roda `scripts/check-guardrails-diff.sh` para compensar.
- Empresa de teste só se apaga pelo expurgo (`rs_fn_expurga_empresa`, depois de `excluida_em` com 7+ dias); o `cleanup()` de `tests/helpers.ts` faz isso.
