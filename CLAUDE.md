# CLAUDE.md — Contrata

Fonte única de verdade: `spec.md` (v0.4.4). Planos aprovados: `plans/`. Os princípios da seção 0 desempatam dúvidas. Itens da seção 25 → **pare e pergunte**. Referências: `~/assina` (login, R2, Resend, webhooks, OAuth) e `~/agenda-psi/mcp-server` (MCP Apps, formulários, fallback com prévia). Leia antes de reinventar. Mudou schema, rota, ferramenta ou tela → atualize `DOCUMENTACAO-TECNICA.md`, este arquivo e o README no mesmo commit.

## Regra de ouro
Se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.
Bug: teste que reproduz → ver falhar → commit → `touch .claude/fix-mode` → corrigir → `rm .claude/fix-mode`.

## Estado
Spec **v0.4.4: um sistema para agentes, não para humanos**. Quem recruta opera pelo Claude ou pelo ChatGPT; não há painel. Clone e use: quem cria empresa é `CRIACAO_EMPRESA_EMAILS` (11.33). Épicos 8.0, 8.1, 8.2 (o conector), 8.3 (vagas e página de carreiras) e 8.4 (candidatura e link `/c`) concluídos no local, com as migrations no remoto (21/11/2026). Pendentes, com o Alexandre: nome e domínio (25.1), DNS na Vercel, cliente OAuth do Google, bucket R2 e, com eles, o teste no Claude, no ChatGPT, no Teste de Pesquisa Aprimorada e o e-mail real pelo Resend. Próximo: 8.5 (funil), em plan mode. 25.1 decide-se antes do 8.12.

## Como uma ação nova entra (padrão do 8.2)
1. Função de domínio em `src/server/<área>/` com `ator` e, se lê candidaturas, `alcance`.
2. Consulta → `consulta(...)` em `src/server/mcp/read.ts`. Escrita → pasta `src/server/mcp/forms/<acao>/` com `index.ts` (`DefinicaoFormulario`: escopo, papel, entrada, `montar`, `opcoes`, schema) e `save.ts`; registre em `src/server/mcp/server.ts`. O HTML é o genérico (`ui/formulario/`); campo novo = tipo novo em `src/lib/formularios.ts` + desenho em `ui/formulario/main.ts`.
3. Copy em `copy.mcp` (`titulos`, `descricoes`, `form.<acao>`). Rota da API v1 quando houver porta.
4. Teste pelo `/mcp` (`callTool` de `tests/helpers.ts`) e veja o formulário em `/dev/formularios`.

## Regras que não se quebram
- **Princípio 1, agente primeiro:** cada ação nasce como função de domínio em `src/server/`, depois como ferramenta MCP, depois como rota da API v1 quando houver porta. **Nenhuma tela de painel nova.** Na web ficam só entrar, consentir (`/oauth/autorizar`) e convite, o candidato e as páginas públicas.
- **Princípio 6, o modelo propõe e a pessoa grava** (padrão de `~/agenda-psi/mcp-server`). Escrita por formulário: `abrir_formulario_*` é `visibility ["model"]`; opções e `salvar_*` são `["app"]`. O servidor revalida tudo. Classes da 11.34: C consulta, O operação direta (mover etapa, nota), F formulário, D decisão.
- **Princípio 2 e regra 11.7:** decisão (reprovar, contratar, encerrar com ativas, reabrir) só pelo clique no formulário (`salvar_decisoes`, `salvar_propostas`). API v1 e `propor_decisao` criam proposta. Decisão não tem fallback com prévia. Nenhuma credencial confirma por chamada direta.
- **Regra 11.5:** nenhuma candidatura sai de `ativa` para `reprovada` ou `encerrada_vaga` sem devolutiva enviada na mesma transação.
- **Login só pelo Google**, dentro do OAuth do conector e do convite. O candidato nunca tem conta.
- **Alcance (11.32):** administrador vê tudo; recrutador, as áreas dele (ou todas); avaliador, só a equipe da vaga. Toda consulta filtra por `empresa_id` e alcance; o vínculo é relido a cada chamada.

## Convenções (seção 18)
- Banco em português `snake_case`, **sempre com prefixo `rs_`** (projeto Supabase compartilhado `jeesdmfcrmhyufwzwzwt`). Código, variáveis e arquivos em inglês; fronteira em `src/server/db/`.
- Cabeçalho em português em toda função, rota, ferramenta MCP, trigger e função SQL: o que faz, recebe, devolve e a regra (`// Implementa a regra 11.7: pela API, reprovar vira proposta`).
- Segredos só em `src/server/`, `src/app/api/`, `src/app/mcp/`, `src/app/oauth/`, `src/app/.well-known/`, `src/app/sair/`, `src/app/convite/` e `scripts/`. Todo arquivo de `src/server/` começa com `import "server-only"`.
- Copy só em `src/lib/copy.ts` (inclusive descrições das ferramentas MCP e do OpenAPI); números só em `src/lib/limits.ts`, com o número da regra.
- Toda escrita de domínio recebe `ator: Ator` (sem padrão); toda leitura de candidaturas recebe `alcance: Alcance`.
- Nenhum dado pessoal em log, evento, webhook de erro, analytics ou corpo de erro.

## Comandos
- `npm run verify`: typecheck, lint, `test` (guardrails 46/46 + varredura do repositório pelos hooks + pgTAP + Vitest), build e `npm audit`. Saída saudável: `46 de 46 casos ok`, `N de N verificações ok`, `Result: PASS`, `Tests N passed`, tabela de rotas, `found 0 vulnerabilities`.
- `npm run dev` em `http://localhost:3050` · `supabase start` (portas **557xx**; o seed cria a Padaria Exemplo) · `npm run db:types` · `npm run db:schema`.
- Sem cliente Google, em dev: `node scripts/dev-session.mjs carla@padaria.exemplo` imprime um cookie de sessão de um usuário do seed (para `/oauth/autorizar` e `/convite`).
- Formulários sem Claude: `npm run dev` e abra `http://localhost:3050/dev/formularios` (só existe em desenvolvimento). Cole um token `rsm_` local (o `createTestToken` de `tests/helpers.ts` mostra como gerar), escolha a ferramenta e os argumentos, e o host abre o formulário com o `AppBridge` de verdade, com tema claro ou escuro.

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
- Toda página ou layout que lê a sessão leva `export const instant = false`, (ex.: `/convite`, `/oauth/autorizar`). O opt-out vale por segmento.
- O Next 16 mantém cópias escondidas no DOM: `get_page_text` e `querySelector` podem ler o fallback ("Carregando…") enquanto a tela mostra o conteúdo. Confira por screenshot.
- Vitest 5.1.1: um `vi.fn` que rejeita é dado como falha do teste mesmo quando a rota trata o erro. Para simular erro de dependência, use uma função comum controlada por variável (ver o teste do callback). Fixar `vitest@5.1.0` quebra o `npm install` (bug do arborist com o peer opcional `@vitest/browser-playwright`).
- Esta pasta pode ser editada de uma sessão aberta em outro projeto, onde os hooks daqui não disparam: o `npm test` roda `scripts/check-guardrails-diff.sh` para compensar.
- Empresa de teste só se apaga pelo expurgo (`rs_fn_expurga_empresa`, depois de `excluida_em` com 7+ dias); o `cleanup()` de `tests/helpers.ts` faz isso.
- **`export const runtime` quebra o build com `cacheComponents`.** Rota que precisa de Node já roda em Node; não exporte `runtime`.
- Scripts com `await` no topo rodam pelo `tsx` só como `.mts` (`scripts/build-ui.mts`, `vite.config.mts`); como `.ts` dá `ERR_REQUIRE_ASYNC_MODULE`.
- O build do Vite muda `NODE_ENV` para `production` no meio do script: leia `NODE_ENV` **antes** de chamar `build()` (ver `DESENVOLVIMENTO` em `scripts/build-ui.mts`).
- Host de MCP Apps: conecte o `AppBridge` **antes** de pôr o `srcdoc` no iframe, senão o `ui/initialize` do formulário se perde e a tela fica em branco. Mande também `hostContext.styles.variables`, senão o tema escuro sai com fundo branco.
- `.meta({ id })` em schema zod faz o `z.toJSONSchema` emitir `$ref` para `#/$defs/…` que o documento OpenAPI não tem. Não use `id` nos schemas da API v1.
- `registerAppTool` com schema genérico não acha o overload: faça o cast `as unknown as z.ZodObject<z.ZodRawShape>` (como em `forms/registrar.ts`). E nada de `.refine` no schema de formulário: quebra o `.extend` do fallback; a regra condicional vai para o `save.ts`.
- `guard-decisoes` libera confirmar decisão e mexer em acesso **só** em `src/server/mcp/forms/*/save.ts`; o `index.ts` do formulário e o fallback continuam barrados.
- **Nada que mexe em acesso tem fallback** (13.5, v0.4.2): formulário de acesso nasce com `fallback: false`; operação de acesso dentro de formulário com fallback vai em `soNoFormulario`.
- A chave de API (e qualquer segredo) só sai no `structuredContent.segredo` do `salvar_*`, nunca no `content` de texto: o texto vai para o modelo.
- **Página pública com Cache Components:** `params` de rota dinâmica é dado de requisição. As páginas de `src/app/[empresa]/` têm `generateStaticParams` com uma amostra (aí o slug é conhecido fora do `Suspense` e o 404 é de verdade) e `export const instant = false`; `searchParams` só dentro de `Suspense`. Dados com `'use cache'` + `cacheTag("carreiras:{slug}")` em `src/app/[empresa]/dados.ts`; toda escrita de vaga chama `invalidarPaginas`. Mudança direta no banco (SQL) não limpa o cache: a primeira requisição depois de 60 s ainda vem velha (stale-while-revalidate).
- O build renderiza a amostra (`padaria-exemplo`) contra o banco configurado: sem banco no ar, o build falha. Local: `supabase start` antes do `verify`.
- `notFound()` dentro de `Suspense` dá a página 404 com status 200 (o cabeçalho já saiu). Para 404 de verdade, decida antes do `Suspense`.
- Erro de campo do domínio: lance `CamposInvalidos([{campo, codigo}])` (`src/server/http.ts`). Caminho com pontos ("etapas.2.nome") marca o subcampo do item no formulário; campo vazio vira erro geral; na API v1 vira `400 dados_invalidos` com `campos`.
- Fallback de edição (`registrar_*` de um formulário que edita): o modelo manda só o que muda. O `save.ts` junta com o registro atual e não regrava lista que não veio (ver `forms/vaga/save.ts`); senão, o que faltou some.
- Campo `lista` do formulário: o item guarda chaves que não desenha (o `id` da etapa) e as devolve no salvar; `mostrarSe` de subcampo compara com o próprio item.
- Faxina: `src/server/cron.ts` (`runDailyCleanup`) cresce a cada épico, na ordem da seção 9; `/api/cron/diario` exige `Bearer CRON_SECRET`.
- **Candidatura em duas fases (8.4):** criar devolve `{id, upload_url?, concluir_token}` e a candidatura nasce **não recebida** (`recebida_em` nula); só `concluir` a torna visível. Toda consulta de candidaturas para a empresa filtra `recebida_em is not null`. A faxina apaga as não recebidas com 24 h.
- O token `/c` nunca sai para a empresa (nem na API) e nunca é guardado em claro: no banco, só o hash; na mensagem guardada, só `{{link_acompanhamento}}`. Reenviar o link gera token novo.
- IP e e-mail dos limites públicos só como HMAC (`chaveDoIp`, com `SESSION_SECRET`), em `rs_tentativas_publicas`. `ipDaRequisicao` lê `x-forwarded-for`.
- Sem `S3_*`, o currículo vai para `.armazenamento-local/` e a URL de upload é `/api/dev/arquivos/…` assinada; nos testes (`tests/setup.ts` apaga as `S3_*`) use `uploadTo` de `tests/helpers.ts`. Para conferir o tipo do arquivo, sempre os bytes (`confereCurriculo`), nunca a extensão nem o `content-type`.
- Campo `arquivo` do formulário: o valor é `{nome, tipo, base64}` ou `""`; o `save.ts` decodifica e passa os bytes ao domínio. Sem formulário não há arquivo: use `soNoFormulario`. Teto de 3 MB (`CURRICULO_CHAT_MAX_BYTES`): o corpo do `/mcp` na Vercel vai até 4,5 MB.
- Nada secreto no **assunto** de e-mail: depois do envio a fila apaga só `html` e `texto`.
- O e-mail do candidato não é verificado: a candidatura nunca altera um cadastro que já existe, e consentimento (talentos) só vale na conclusão.
- O servidor de desenvolvimento às vezes fica com um módulo velho depois de muitas edições (ex.: `copy.mcp.form.<acao>` indefinido no `/mcp` com o `tsc` e os testes verdes): reinicie o `npm run dev`.
