# Plano — Spec v0.4: Contrata "para agentes" (MCP first, headless)

Status: aprovado pelo Alexandre em 20/11/2026 (plan mode) e executado no mesmo dia. Decisão de detalhe tomada na execução: as escritas pelo chat têm quatro classes (regra 11.34); mover etapa e adicionar nota são operações diretas do agente (assunção 24.14).

## Contexto
Em 20/11/2026, depois do 8.1, o Alexandre redefiniu o produto: **"o mais prático sistema headless de recrutamento e seleção", um sistema para agentes e não para humanos**. O console do LLM (Claude, ChatGPT) é a tela principal. O modelo é o do agenda-psi: consulta em linguagem natural e escrita por formulário dentro do chat (MCP Apps), com o princípio "o modelo propõe, a pessoa grava".

Decisões tomadas na conversa (AskUserQuestion):
1. **Pergunta 25.3, respondida.** Decisões sobre pessoas (reprovar, contratar, encerrar vaga com candidaturas ativas) são confirmadas pelo botão do formulário no chat. Em cliente sem formulário (Claude Code, n8n, API v1), elas ficam como proposta pendente até alguém confirmar num cliente com formulário.
2. **Avaliadores e gestores** avaliam só pelo LLM, num formulário no chat. Quem não tem LLM passa a opinião ao recrutador, que registra como nota. Dono de vaga sem acesso continua recebendo o resumo semanal por e-mail.
3. **O painel web do 8.1** (Equipe, Áreas, Pessoas, menu lateral) sai. Equipe, áreas e pessoas viram formulários no chat. Banco, domínio e testes ficam.
4. **O lado do candidato** continua na web: página de carreiras com JobPosting, formulário de candidatura com upload e link `/c/{token}`.

Este plano cobre **só a reescrita do spec (v0.4) e dos documentos**, sem código. A retirada do painel acontece dentro do 8.2, junto com os formulários que o substituem, para o app nunca ficar sem forma de administrar. O 8.2 terá plano próprio, em plan mode.

## O que entra no spec v0.4

### Princípios (seção 0)
- **P1 vira "Agente primeiro".** Cada ação existe como função de domínio em `src/server/`, depois como ferramentas MCP, depois como rota da API v1 (para integrações). As ferramentas MCP são de dois tipos:
  - consulta em linguagem natural (`readOnlyHint`);
  - escrita pelo par `abrir_formulario_*` (visível ao modelo) e `salvar_*` (visível só ao formulário).

  Não existe painel web de operação. A web serve só a três coisas: (a) entrar, consentir e aceitar convite, porque o OAuth exige navegador; (b) o candidato; (c) a página inicial, a documentação e as páginas legais.
- **P2 (quem decide sobre uma pessoa é outra pessoa)** passa a valer pelo clique: a confirmação é o `salvar_*` de um formulário, que o modelo não enxerga. Nenhuma credencial confirma por chamada direta: nem a prévia com token, nem a API v1, nem uma ferramenta visível ao modelo.
- **Princípio novo, trazido do agenda-psi: "o modelo propõe, a pessoa grava".** Nenhuma ferramenta visível ao modelo grava no primeiro chamado. O servidor revalida tudo antes de gravar.
- O **fallback com prévia** (HMAC, 10 min, `MCP_PREVIEW_SECRET`) vale só para escritas que **não** são decisões, em clientes sem MCP Apps. Para decisões, o fallback só cria a proposta.
- P3, P4 e P5 não mudam.

### Seções a reescrever
| Seção | Mudança |
|---|---|
| Cabeçalho, 1, 2 | Visão "para agentes". O recrutador opera pelo Claude ou pelo ChatGPT. Avaliador e gestor também usam um LLM com o conector. A persona "Agente" vira a interface, não um ator extra |
| 3 | **Dentro:** formulários no chat para toda escrita, inclusive a administração. **Fora:** painel web de operação (descartado, decisão de 20/11/2026) |
| 4 | **MCP:** SDK v2 (`@modelcontextprotocol/server`, stateless) + `@modelcontextprotocol/ext-apps` 2.x. Formulários em TypeScript + Vite singlefile, sem React, com CSP `connect-src 'none'` e tudo passando por `callServerTool`. Detecção de MCP Apps por `getUiCapability`, como em `agenda-psi/mcp-server/src/client-capabilities.ts`. O handler continua na rota `/mcp` do Next, num deploy só. **Premissa (e) a validar no 8.2:** o handler do SDK v2 roda dentro de uma rota do Next 16 e serve os recursos `ui://` |
| 5 | A coluna "Administrador/Recrutador/Avaliador" passa a dizer **"pelo formulário no chat"**. A lista "sem porta" encolhe: equipe, áreas, pessoas, chaves, webhooks e empresa ganham formulário (só administrador). Quem grava é o clique, e o princípio 2 já cobre isso. Continuam sem porta de máquina, ou seja, só por formulário e nunca pela API v1: confirmar decisão, gerir membros e chaves, avaliar |
| 6 | **6.1:** sessão web só no OAuth, no convite e no consentimento. Aceite dos Termos e criação da primeira empresa vão para a tela de consentimento (`/oauth/autorizar`), para quem está em `CRIACAO_EMPRESA_EMAILS`. **6.4:** o consentimento ganha "Criar empresa". `/convite/{token}` termina em "Conecte o Contrata no Claude ou no ChatGPT" |
| 8 | Épicos reordenados (abaixo) |
| 9 | Fluxos ponta a ponta pelo chat. "Para confirmar" vira `abrir_formulario_propostas`: lista as pendentes, permite editar a devolutiva e confirma em lote até 50 |
| 10 | O inventário passa a ter duas partes: **páginas web** (entrar, consentimento, convite, candidato, docs, legais, início) e **formulários** (um por ação, com campos e ferramenta de opções) |
| 11 | **11.7:** confirmação = `salvar_*` de formulário; API v1 e fallback criam proposta. **11.25:** o login continua só pelo Google, agora no fluxo OAuth. **11.9:** o avaliador registra pelo formulário |
| 13 | **13.1:** sem `/api/painel/*`. **13.3:** tabela "ação → abre (modelo) → opções (app) → salva (app) → fallback" no formato do agenda-psi, para todas as ações, inclusive a administração. Convenções de visibilidade e anotações do agenda-psi 13.1. A API v1 (13.2) fica como está, para integrações |
| 15 | A copy do painel (15.2) vira copy de formulário e de resposta de ferramenta. A copy do candidato (15.1) e os e-mails (15.4) não mudam |
| 16 | **Formulários:** tema do host (variáveis de cor do ext-apps), uma coluna, campo de 44 px, mesmos tokens. **Páginas do candidato e de carreiras:** não mudam. O menu lateral e as telas de painel saem |
| 17, 18, 21, 22, 23, 24, 26 | Requisitos de formulário (HTML < 300 KB, como no agenda-psi). Pastas `src/server/mcp/{read,forms}/` e `ui/`. Eventos com `origem` "formulario". Teste de que toda ferramenta que confirma decisão tem visibilidade `["app"]`. Riscos novos: confiança no host, avaliador sem LLM, cliente sem MCP Apps. Assunção nova: os hosts respeitam a visibilidade `app`. DoD com o fluxo 9.1 inteiro no Claude e no ChatGPT |
| 25 | 25.3 respondida |
| Anexo B | O `guard-decisoes` passa a liberar a confirmação **só** em `src/server/mcp/forms/**/save*.ts`, além de bloquear a API v1, a API pública e as ferramentas visíveis ao modelo. Os casos novos entram em `test-guardrails.sh` no 8.2 |

### Nova ordem dos épicos
| Épico | Conteúdo |
|---|---|
| 8.0, 8.1 | Concluídos. Do 8.1 ficam o banco, o login, o domínio da administração e os testes |
| **8.2 MCP e formulários** | OAuth do MCP (consentimento com escolha ou criação de empresa e aceite dos Termos), handler, infraestrutura de formulários e fallback. Ferramentas: `quem_sou_eu`, consultas de equipe, áreas e pessoas, e os formulários de convite, mudança de acesso, áreas e pessoas (paridade com o 8.1). Chaves de API por formulário e esqueleto da API v1. **Retirada do painel web** |
| 8.3 | Vagas (formulários de criar e editar, publicar e pausar) e página de carreiras |
| 8.4 | Candidatura (web do candidato) e formulário `adicionar_candidato` |
| 8.5 | Funil, com avaliação por formulário (11.9) |
| 8.6 | Decisões (`abrir_formulario_propostas`), devolutivas e mensagens |
| 8.7 a 8.11 | Sem mudança de conteúdo; toda configuração vira formulário |
| 8.12 | Página inicial e `/docs/mcp` como porta de entrada ("conecte no Claude ou no ChatGPT"), legais e auto-hospedagem |

## Arquivos
- `spec.md`: v0.4, com o motivo no cabeçalho.
- `modelo-contrata.dbml`: sem mudança de tabela. Só `rs_origem_evento` ganha `formulario`, o que no banco será uma migration do 8.2.
- `plans/spec-v0.4-agentes.md`: este plano.
- `CLAUDE.md`: Estado e as regras novas ("Agente primeiro", "o modelo propõe, a pessoa grava").
- `README.md`: posicionamento.
- `DOCUMENTACAO-TECNICA.md`: estado e a divergência registrada (o painel do 8.1 sai no 8.2).

Nenhum código muda neste passo.

## Verificação
- Releitura do spec procurando referências que sobraram: `grep -n "painel"`, `"Para confirmar"` e `requireMembro(` fora de contexto.
- `./scripts/check-guardrails-diff.sh` e `npm run verify` continuam verdes: só documentação muda.
- Um commit `docs(spec): v0.4 — sistema para agentes`.
- Em seguida, plan mode do 8.2. Recomendo fazê-lo numa sessão aberta em `~/contrata`, para os hooks dispararem e as migrations irem ao remoto.
