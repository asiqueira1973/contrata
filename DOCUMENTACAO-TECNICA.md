# Documentação técnica — Contrata

Descreve o que está **de fato** implementado, na ordem da seção 19 do `spec.md` (v0.4). Toda mudança de schema, trigger, rota, ferramenta ou lógica de tela atualiza este documento no mesmo commit.

## Estado (21/11/2026)
Épicos 8.0 (guardrails), 8.1 (fundação), 8.2 (o conector) e **8.3 (vagas e página de carreiras)** concluídos no local, com as migrations no remoto (pelo `apply_migration`, mesmo SQL dos arquivos; 26 tabelas e 38 funções `rs_`, nenhuma exposta a `anon`/`authenticated`). **Spec v0.4.2: sistema para agentes, sem painel.** Quem recruta conecta o Contrata no Claude ou no ChatGPT (`{site}/mcp`) e, pelo chat, administra a equipe e cria, edita, publica, pausa e encerra vagas; a vaga publicada aparece na página de carreiras, no feed, no sitemap e na API pública. Pendentes, com o Alexandre: nome e domínio (25.1), DNS na Vercel, cliente OAuth do Google e, com eles, o teste no Claude, no ChatGPT e no Teste de Pesquisa Aprimorada do Google. Candidaturas chegam no 8.4.

---

## 1. Modelo de dados

Todas as tabelas `rs_*` existem desde o 8.1 (migration `20261120180000_rs_schema.sql`), com RLS ligada, nenhuma política e nenhum privilégio para `anon`/`authenticated`: só o servidor, com a service role, lê e escreve (6.5). O schema gerado está em `supabase/schema.sql`.

**Em uso até o 8.3** (as demais tabelas existem e ganham uso nos próximos épicos):

| Tabela | O que guarda, em linguagem de negócio |
|---|---|
| `rs_usuarios` | Quem entra (no consentimento do conector ou no convite). Identificado pelo `google_sub` da conta Google; `email` e `nome` são atualizados a cada login. `termos_aceitos_em` nulo = ainda não passou das boas-vindas. `suspenso_em` preenchido = não entra (suspensão por SQL, feita por quem hospeda) |
| `rs_empresas` | Cada empresa que recruta. `slug` é o endereço da página de carreiras (`/{slug}`). `email_contato` recebe as respostas dos candidatos. `excluida_em` agenda o expurgo |
| `rs_membros` | Vínculo de uma pessoa com uma empresa. Enquanto `usuario_id` é nulo, é um **convite pendente** (com `convite_token_hash` e `convite_expira_em`). Papel: `administrador` (tudo), `recrutador` (conduz vagas; `todas_areas = false` limita às áreas de `rs_membro_areas`), `avaliador` (só avalia nas vagas em que está). `removido_em` = saiu da empresa |
| `rs_membro_areas` | Áreas de um recrutador limitado |
| `rs_areas` | Departamentos da empresa, um nível. `responsavel_pessoa_id` vira o dono padrão das vagas novas da área. `arquivada_em` = fora das listas |
| `rs_pessoas` | Gente da empresa que participa do recrutamento (gestores, donos de vaga), com ou sem acesso. `membro_id` nulo = **sem acesso**. Todo membro tem uma linha aqui |
| `rs_credenciais` | Chaves de API (`rsk_…`, da empresa, criadas por administrador) e tokens do conector (`rsm_…`, de um membro, criados pelo OAuth). Guarda só o SHA-256 e os 8 primeiros caracteres. `escopos` (`leitura`, `escrita`, `decisao`), `revogada_em`, `ultimo_uso_em` (atualizado no máximo uma vez por minuto) |
| `rs_oauth_clientes` | Clientes do conector registrados por DCR (Claude, ChatGPT, Inspector): nome e `redirect_uris` |
| `rs_oauth_codigos` | Códigos de autorização de uso único (só hash), com o `code_challenge` S256, escopos, membro e empresa. `credencial_id` liga o código ao token que ele gerou, para revogar o token se o código for reapresentado |
| `rs_eventos` | Trilha, só inserção. Cada linha diz o tipo (catálogo fechado da 15.3), o ator (membro, candidato, sistema, api, agente), a origem e `dados` sem dado pessoal (ids, papéis, contagens) |
| `rs_vagas` | A vaga: título, `slug` (do título, único na empresa, muda só até a 1ª publicação), descrição e requisitos em Markdown, área, dono (pessoa), modelo de trabalho, local, regime, salário (com `mostrar_salario`), `encerra_em`, `status` (máquina 12.1), `publicada_em` (só a primeira), `encerrada_em` e motivo. `chave_idempotencia` (8.3): a `Idempotency-Key` do `POST /api/v1/vagas` |
| `rs_etapas` | Etapas da vaga (1–15, ordem única adiável); o `tipo` decide o que o candidato vê (11.21). Toda vaga nasce com as etapas padrão de `limits.ts` |
| `rs_perguntas` | Perguntas da candidatura (0–10), congeladas depois da 1ª publicação; `resposta_esperada` só em sim/não e escolha única (11.10) |
| `rs_vaga_equipe` | Quem conduz (um `responsavel`, recrutador+) e quem avalia (`avaliador`) na vaga. O dono com acesso entra sempre como avaliador (11.31) |
| `rs_notificacoes` | Fila de e-mail idempotente: cada e-mail tem uma `chave_idempotencia` única; status `pendente` → `enviada` ou `falhou` |

Valores de enum em uso: `rs_papel_membro` (administrador, recrutador, avaliador), `rs_tipo_ator` (membro, agente, api, sistema), `rs_status_vaga`, `rs_modelo_trabalho`, `rs_regime`, `rs_tipo_etapa`, `rs_tipo_pergunta`, `rs_papel_na_vaga`, `rs_motivo_encerramento_vaga`, `rs_origem_evento` (`formulario`, `mcp`, `api`, `web`, `publico`, `cron`; o antigo `painel` virou `web` no 8.2), `rs_tipo_notificacao` (`convite_membro`), `rs_status_notificacao` (pendente, enviada, falhou). Os enums do convite da instância (`rs_status_pedido_convite`, `pedido_convite_*`) **não existem**: saíram no spec v0.3.

## 2. Relacionamentos

- Um usuário pode ser membro de várias empresas; uma empresa tem vários membros, com um só vínculo ativo por usuário e por e-mail em cada empresa.
- Uma empresa tem várias áreas e várias pessoas; uma pessoa pertence a no máximo uma área; uma área tem no máximo um responsável, que é uma pessoa.
- Cada membro aceito tem exatamente uma pessoa ligada (`rs_pessoas.membro_id` é único); pessoa sem acesso não tem membro.
- Um recrutador limitado tem uma ou mais áreas (`rs_membro_areas`).
- Tudo de uma empresa (membros, áreas, pessoas, eventos, notificações e, nos próximos épicos, vagas e candidaturas) é apagado em cascata quando a empresa é expurgada.

## 3. Lógica no banco

Migrations `20261120180100_rs_logica_base.sql` e `20261120190000_rs_ultimo_admin_trava.sql` (esta trava os administradores ativos antes de contar, para a 11.26 valer sob concorrência). Todas as funções: `plpgsql`, `SECURITY INVOKER`, `search_path = ''`, `EXECUTE` só para `service_role`. Erros de regra saem como `P0001` com a mensagem igual ao código (ex.: `ultimo_administrador`), que o servidor traduz para a copy.

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_tg_atualizado_em` | trigger `before update` | `rs_empresas`, `rs_areas`, `rs_pessoas`, `rs_vagas`, `rs_candidatos`, `rs_avaliacoes`, `rs_modelos_mensagem` | Atualiza `atualizado_em` |
| `rs_fn_registra_evento` | função | toda função que muda estado | Única porta de escrita em `rs_eventos`; exige ator; o check da tabela recusa tipo fora do catálogo |
| `rs_tg_eventos_imutaveis` | trigger `before update or delete` em `rs_eventos` | sempre | Recusa (`trilha_imutavel`), exceto o delete do expurgo da empresa marcada em `rs.expurgo_empresa` |
| `rs_fn_expurga_empresa(empresa)` | função | faxina (8.10) e limpeza dos testes | Só para empresa excluída há 7+ dias: libera a trilha daquela empresa na transação e apaga tudo em cascata |
| `rs_tg_situacao_candidatura` | trigger `before insert or update` em `rs_candidaturas` | sempre | Candidatura nasce `ativa`; `situacao` só muda com `rs.transicao = 'on'` e só pelas transições da 12.2 |
| `rs_tg_etapa_da_vaga` | trigger `before insert or update` em `rs_candidaturas` | ao gravar etapa, vaga, empresa ou candidato | Etapa da mesma vaga; empresa igual à da vaga e à do candidato (11.27) |
| `rs_tg_vaga_congelada` | trigger em `rs_vagas` e `rs_perguntas` | update/delete da vaga; insert/update/delete de pergunta | Vaga encerrada não muda; só rascunho se apaga; perguntas não mudam depois da primeira publicação (11.1). O expurgo passa |
| `rs_fn_entra_usuario(sub, email, nome, foto)` | função | login (callback do Google) | Recusa suspenso e e-mail de outro usuário; cria ou atualiza o usuário; aceita os convites pendentes do e-mail; devolve id, se é novo e os slugs das empresas |
| `rs_fn_aceita_convite(membro, usuario)` | função | login e botão "Aceitar convite" | Mesmo e-mail (sem diferenciar maiúsculas) e não vencido (11.24); liga ou cria a pessoa; evento `membro_entrou` |
| `rs_fn_cria_empresa(usuario, slug, nome, email)` | função | "Criar empresa" | Empresa + membro administrador + pessoa; `slug_em_uso` se repetido; evento `empresa_criada`. Quem pode criar é conferido antes, no servidor |
| `rs_fn_convida_membro(...)` | função | "Convidar" e "Dar acesso" | Confere áreas (11.32) e o limite de convites pendentes; tira do caminho convite vencido do mesmo e-mail; `membro_ja_existe` se já há vínculo; evento `membro_convidado` |
| `rs_fn_reenvia_convite` / `rs_fn_cancela_convite` | funções | Equipe | Token e prazo novos / soft delete do convite; eventos `membro_convidado` (com `reenvio`) e `convite_cancelado` |
| `rs_fn_muda_acesso(...)` | função | "Mudar acesso" | Recusa último administrador (11.26) e recrutador limitado sem área; troca papel e áreas; revoga os tokens MCP do membro; evento `membro_acesso_alterado` |
| `rs_fn_remove_membro(membro, ator)` | função | "Remover" | Recusa último administrador; soft delete; revoga tokens MCP; desliga a pessoa (que fica sem acesso); evento `membro_removido` |
| `rs_fn_salva_area` / `rs_fn_arquiva_area` | funções | Áreas | Nome único entre as ativas; responsável precisa ser pessoa ativa; arquivar recusa vaga publicada/pausada na área ou área única de recrutador limitado (`area_em_uso`) |
| `rs_fn_salva_pessoa` / `rs_fn_arquiva_pessoa` / `rs_fn_da_acesso` | funções | Pessoas | E-mail único entre as ativas; e-mail de quem tem acesso não muda; arquivar recusa quem tem acesso ou é dono de vaga aberta e tira a pessoa de responsável de área; dar acesso vira convite |
| `rs_fn_valida_areas` / `rs_fn_garante_administrador` | auxiliares | dentro das funções acima | Regras 11.32 e 11.26 num lugar só |

Do 8.2, migration `20261121090000_rs_conector.sql`:

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_fn_registra_evento` (redefinida) | função | sempre | Se o ator traz `origem`, ela vale no lugar da origem passada pela função. Assim as funções do 8.1 gravam `formulario` ou `mcp` sem mudar de assinatura |
| `rs_fn_cria_codigo_oauth(hash, cliente, empresa, membro, escopos, redirect, challenge, validade)` | função | "Permitir" no consentimento | Confere que o membro está ativo; grava o código |
| `rs_fn_troca_codigo_oauth(hash, cliente, redirect, verifier_s256, token_hash, prefixo)` | função | `POST /oauth/token` | Trava o código; confere validade, cliente, redirect, PKCE e membro ativo; cria a credencial `mcp` e o evento `mcp_conectado`. Código reapresentado revoga o token gerado com ele. **Nunca levanta erro** (devolve nulo), para a revogação não ser desfeita |
| `rs_fn_cria_chave_api(empresa, nome, escopos, hash, prefixo, ator)` | função | formulário de conexões | Limite de 10 chaves ativas (`limite_chaves`, 11.15); evento `credencial_criada` |
| `rs_fn_revoga_credencial(credencial, empresa, ator)` | função | formulário de conexões | Revoga chave ou token da empresa; evento `credencial_revogada` |

As 11 funções do 8.1 que gravavam a origem `'painel'` foram redefinidas com `'web'`.


Do 8.3, migration `20261121180000_rs_vagas.sql` (mais os índices das duas FKs que o advisor apontou no 8.2):

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_tg_vaga_encerrada_filhos` | trigger em `rs_etapas` e `rs_vaga_equipe` | sempre | Vaga encerrada: etapas e equipe não mudam (`vaga_encerrada`); a vaga e as perguntas já eram guardadas por `rs_tg_vaga_congelada` |
| `rs_fn_vaga_no_alcance` / `rs_fn_area_no_alcance` | auxiliares | dentro das funções de vaga | Alcance da 11.32 no banco: `{tipo: todas | areas | equipe}`. Recrutador limitado não usa área de fora nem "Sem área" |
| `rs_fn_slug_vaga` | auxiliar | criar | Slug do título (sem acento), com `-2`, `-3` na colisão |
| `rs_fn_grava_etapas` / `rs_fn_grava_perguntas` / `rs_fn_grava_equipe` | auxiliares | criar e editar | Etapas 1–15 (com id: renomeia e reordena; tirar etapa com candidatura: `etapa_com_candidaturas`); perguntas 0–10, e depois de publicada só passa a mesma lista (`perguntas_congeladas`); equipe com um responsável recrutador+ e o dono com acesso como avaliador |
| `rs_fn_cria_vaga(empresa, dados, alcance, ator, chave)` | função | formulário, fallback, `POST /vagas` | Rascunho + etapas + perguntas + equipe; dono padrão = responsável da área; chave repetida devolve a mesma vaga; evento `vaga_criada` |
| `rs_fn_salva_vaga(vaga, empresa, dados, alcance, ator)` | função | formulário, `PATCH` e `PUT` | Fora do alcance: `nao_encontrado`; área nova no alcance; etapas, perguntas e equipe só se vierem; eventos `vaga_editada` e `vaga_dono_alterado` |
| `rs_fn_transicao_vaga(vaga, empresa, para, motivo, alcance, ator, max)` | função | publicar, pausar, encerrar | Máquina 12.1; publicar confere de novo a 11.1 (descrição 50+, etapa, local, data-limite ≥ hoje em São Paulo) e o limite de 50 publicadas (11.14); `publicada_em` só na primeira; encerrar exige motivo e recusa candidatura ativa (`vaga_com_ativas`, decisão do 8.6) |
| `rs_fn_faxina_vagas_vencidas(lote)` | função | `/api/cron/diario` | Pausa (não encerra) a publicada com `encerra_em` < hoje em São Paulo, `for update skip locked`; evento `vaga_pausada_prazo` (ator sistema, origem cron) |

---

## 4. Mapas

### Páginas web (as únicas que sobraram para quem recruta)
| Página | Rota | Lê | Escreve |
|---|---|---|---|
| Início provisório | `/` | — | — (mostra o endereço do conector) |
| Entrar | `/entrar` | — | `rs_usuarios` (pelo callback) |
| Consentimento do conector | `/oauth/autorizar` | `rs_usuarios`, `rs_membros`, `rs_empresas`, `rs_oauth_clientes` | `rs_usuarios.termos_aceitos_em` (`/oauth/termos`), empresa nova (`/oauth/empresa`), `rs_oauth_codigos` (`/oauth/autorizar/decidir`) |
| Convite | `/convite/{token}` e `/convite/aceito` | `rs_membros`, `rs_empresas` | `rs_membros`, `rs_pessoas` |
| Documentação da API | `/docs/api` | — | — |
| Página de carreiras | `/{empresa}` | `rs_empresas`, `rs_vagas` (publicadas), `rs_areas` | — (só com `pagina_publicada`; antes, só com `?previa=` assinado) |
| Página da vaga | `/{empresa}/vagas/{slug}` | `rs_vagas`, `rs_areas` | — (publicada com JSON-LD; pausada ou encerrada: 200 sem JSON-LD; rascunho: 404) |
| Feed, sitemap, robots | `/{empresa}/vagas.xml`, `/sitemap.xml`, `/robots.txt` | `rs_empresas`, `rs_vagas` | — |
| Host de formulários (só `NODE_ENV=development`) | `/dev/formularios` | — | — (abre e salva formulários de verdade, com um token local) |

### Ferramentas MCP (`/mcp`)
Consultas (`visibility ["model"]`, só `leitura`): `quem_sou_eu`, `listar_equipe` (avaliador vê só nome e áreas), `listar_areas`, `listar_pessoas` (avaliador vê só nome e área), `listar_vagas` (filtros área, dono, status e cursor; avaliador vê só as vagas da equipe dele), `ver_vaga` (aceita título ou id; traz o endereço público, o link de pré-visualização enquanto a página não está publicada e o que falta para publicar) e `resumo_da_vaga` (só contagens).

Formulários: cada um registra `abrir_formulario_<acao>` (modelo), `opcoes_<acao>` e `salvar_<acao>` (app) e, quando o cliente não tem MCP Apps, `registrar_<acao>` (fallback com prévia, 13.5).

| Formulário | Operações | Papel e escopo | Fallback |
|---|---|---|---|
| `convite` | convidar (e-mail, papel, áreas) | administrador, `escrita` | **não** (mexe em acesso) |
| `acesso` | mudar papel e áreas, remover, reenviar convite, cancelar convite | administrador, `escrita` | **não** (mexe em acesso) |
| `area` | criar, editar, arquivar | administrador, `escrita` | sim |
| `pessoa` | cadastrar, editar (recrutador); arquivar, dar acesso (administrador) | recrutador, `escrita` | sim, menos `dar_acesso` (recusado na prévia: `so_no_formulario`) |
| `vaga` | criar em rascunho ou editar: dados, local, salário, data-limite, descrição, **lista de etapas e lista de perguntas** (campo `lista`), dono (com o selo "Sem acesso · recebe resumo semanal", 11.31), responsável e avaliadores; área limitada ao alcance; perguntas só leitura depois de publicada | recrutador, `escrita` | sim |
| `publicar_vaga` | publicar rascunho ou pausada; mostra o que falta pela 11.1 e se a página de carreiras não está publicada | recrutador, `escrita` | sim |
| `pausar_vaga` | pausar a publicada | recrutador, `escrita` | sim |
| `encerrar_vaga` | encerrar sem candidatura em andamento, com motivo e confirmação | recrutador, **`decisao`** | **não** (irreversível) |
| `pagina_de_carreiras` | publicar ou tirar do ar a página; mostra o link de pré-visualização (8.3, parte do formulário da empresa do 8.9) | administrador, `escrita` | **não** |
| `conexoes` | revogar a própria conexão (basta `leitura`); revogar credencial de outro e criar chave de API (administrador **com conexão de `escrita`**; a chave nova tem no máximo os escopos da conexão) | qualquer membro, `leitura` | **não**: a chave só aparece no `structuredContent.segredo` do `salvar_conexoes`, nunca no texto |

### Ação → domínio → portas
| Ação | Domínio (`src/server/`) | Web | API v1 | MCP |
|---|---|---|---|---|
| Entrar | `db/users.enterUser` | `GET /api/auth/google/callback` | — | — |
| Aceitar termos | `db/users.acceptTerms` | `POST /oauth/termos` | — | — |
| Criar empresa | `org/companies.createCompany` | `POST /oauth/empresa` (no consentimento) | — | — |
| Conectar | `oauth/server.createAuthorizationCode`, `exchangeCode` | `/oauth/autorizar/decidir`, `/oauth/token` | — | — |
| Convidar | `org/members.inviteMember` | — | — | `salvar_convite` |
| Reenviar, cancelar, mudar acesso, remover | `org/members.resendInvite`, `cancelInvite`, `changeAccess`, `removeMember` | — | — | `salvar_acesso` |
| Aceitar convite | `org/members.acceptInvite` | `POST /api/convite/{token}/aceitar` | — | — |
| Criar, editar, arquivar área | `org/areas.saveArea`, `archiveArea` | — | — | `salvar_area` |
| Cadastrar, editar, arquivar pessoa; dar acesso | `org/people.savePerson`, `archivePerson`; `org/members.grantAccess` | — | — | `salvar_pessoa` |
| Revogar conexão; criar chave | `credentials/manage.revokeCredential`, `createApiKey` | — | — | `salvar_conexoes` |
| Ler empresa, áreas, pessoas | `org/*.list…` | — | `GET /api/v1/empresa`, `/areas`, `/pessoas` | `quem_sou_eu`, `listar_*` |
| Criar e editar vaga (etapas, perguntas, equipe) | `recruiting/jobs.createJob`, `saveJob` | — | `POST /vagas`, `PATCH /vagas/{id}`, `PUT /vagas/{id}/etapas`, `/perguntas`, `/equipe` | `salvar_vaga`, `registrar_vaga` |
| Publicar, pausar | `recruiting/jobs.transitionJob` | — | `POST /vagas/{id}/publicar`, `/pausar` | `salvar_publicar_vaga`, `salvar_pausar_vaga` (e os `registrar_*`) |
| Encerrar sem candidaturas em andamento | `recruiting/jobs.transitionJob` | — | `POST /vagas/{id}/encerrar` (escopo `decisao`; 409 com candidatura em andamento até o 8.6) | `salvar_encerrar_vaga` |
| Ler vagas | `recruiting/jobs.listJobs`, `getJob`, `jobSummary` | `/{empresa}`, `/{empresa}/vagas/{slug}` (`careers/public`) | `GET /vagas`, `/vagas/{id}`, `/vagas/{id}/resumo`; pública: `GET /api/publico/{e}/vagas`, `/{slug}` | `listar_vagas`, `ver_vaga`, `resumo_da_vaga` |
| Publicar a página de carreiras | `org/companies.setCareersPagePublished` | — | — | `salvar_pagina_de_carreiras` |
| Pausar vencidas (faxina) | `recruiting/jobs.pauseExpiredJobs` via `server/cron.runDailyCleanup` | `GET /api/cron/diario` (`CRON_SECRET`) | — | — |

Guardiões: `requireUsuario` (páginas web com sessão) e `requireCredencial(req, tipos, escopo?)` (`/mcp` e `/api/v1`). O segundo acha a credencial pelo hash, recusa revogada ou de empresa excluída, e, para token do conector, **relê o vínculo do membro a cada chamada**: membro removido ou rebaixado perde o acesso na hora. Escopo efetivo (11.16) = escopos do token ∩ papel (avaliador só `leitura`). Dentro do MCP, cada ferramenta confere escopo e papel mínimo (`bloqueio` em `src/server/mcp/kit.ts`). O alcance (11.32) vem de `org/scope.computeScope`.

## 5. Lógica por porta

- **Login** (`/api/auth/google/callback`): confere `state` e PKCE, valida o `id_token` (assinatura, `aud`, `iss`, `email_verified = true`), recusa e-mail de `EMAILS_BLOQUEADOS`, chama `rs_fn_entra_usuario`. Erros: `/entrar?erro=falha|sem_acesso|suspenso|email_em_uso`. A volta só aceita `/oauth/autorizar…` e `/convite…` (`safeReturnPath`); o padrão é `/`. Convite já aceito pelo próprio login leva a `/convite/aceito`.
- **Consentimento** (`/oauth/autorizar`), nesta ordem: sem sessão → `/entrar?volta=…`; Termos não aceitos → boas-vindas; sem empresa → criar (se o e-mail está em `CRIACAO_EMPRESA_EMAILS`) ou a mensagem da 15.2; com empresa → escolher a empresa (rádio), os escopos (só os que o papel permite) e a garantia "decisões só acontecem quando você clicar em Confirmar no formulário". `decidir` exige POST da mesma origem, sessão e vínculo, corta os escopos pelo papel e redireciona com `code` e `state` (303).
- **Metadados e DCR:** `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource[/mcp]` (com `scopes_supported`), `POST /oauth/registrar`, `POST /oauth/token` (`authorization_code` com PKCE S256; sem refresh token: o token dura até ser revogado).
- **`/mcp`:** 401 com `WWW-Authenticate: Bearer resource_metadata="…"`; o corpo é lido uma vez para detectar MCP Apps (`suporteAUi`: `sim`, `nao` ou `desconhecido`) e repassado ao handler sem estado do SDK v2. `desconhecido` registra formulário **e** fallback.
- **Formulários (12.5):** `abrir_formulario_*` monta campos e valores a partir do pedido do modelo (acha pessoa ou área por nome ou e-mail); a UI carrega as opções por `opcoes_*` e grava por `salvar_*`, que revalida com zod, confere papel e devolve `{ok, resumo}` ou `{ok:false, erros:[{campo, mensagem}]}`. Depois do sucesso o Salvar trava. O evento sai com origem `formulario` e o ator é o membro.
- **Fallback (13.5):** `registrar_*` sem `token_previa` devolve a prévia e um token HMAC (`MCP_PREVIEW_SECRET`, 10 min) amarrado a membro, ação e dados; com o token, grava. Dados diferentes, outra ação, outro membro ou token vencido: `previa_divergente` ou `previa_invalida`. O ator é o agente, origem `mcp`.
- **API v1:** `requireCredencial(req, ["api"], "leitura")`, envelope de erro `{codigo, mensagem}`, cursor base64url. `GET /api/v1/openapi.json` sai de `z.toJSONSchema` dos mesmos schemas de resposta.
- **Vagas (8.3):** a regra 11.1 é o `vagaSchema` de `src/lib/schemas/jobs.ts`, usado pelo `salvar_vaga`, pelo `registrar_vaga` e pela API v1. Erros saem campo a campo (`CamposInvalidos`), com o caminho do item ("etapas.2.nome"): no formulário, embaixo do subcampo; na API, `400 dados_invalidos` com `campos`. Publicar confere antes o que falta (`faltasParaPublicar`) e o banco confere de novo. O `PATCH` junta o que veio com a vaga atual e não mexe nas listas.
- **Páginas públicas:** dados em `'use cache'` com a tag `carreiras:{slug}` e 60 s (`src/app/[empresa]/dados.ts`); toda escrita de vaga e da página chama `invalidarPaginas` (`revalidateTag(…, { expire: 0 })`). `generateStaticParams` devolve uma amostra: assim o slug fica conhecido fora do `Suspense` e empresa ou vaga inexistente dá 404 de verdade; `searchParams` (filtros e `previa`) ficam dentro do `Suspense`. Markdown por `marked` + `sanitize-html` (lista fechada de tags). JSON-LD com `<` escapado.
- **Faxina** (`/api/cron/diario`, `vercel.json` às 9h UTC = 6h em Brasília): `Bearer CRON_SECRET` comparado em tempo constante; lotes de 200 até ~45 s; log só com contagens.
- **E-mail** `convite_membro`: remetente "{empresa} via Contrata", `reply-to` = e-mail de contato da empresa, link `/convite/{token}`. Sem `RESEND_API_KEY`, em desenvolvimento, vai para `.caixa-de-saida-local/`. O corpo é apagado depois do envio.

### Como os formulários são construídos
Um único HTML genérico (`ui/formulario/`), feito com Vite singlefile e sem React, renderiza qualquer formulário a partir da descrição que o servidor manda (`src/lib/formularios.ts`: campos `texto`, `email`, `textarea`, `select`, `radio`, `marcar`, `multipla`, `confirmar`, `numero`, `data` e `lista` — itens que se repetem, com subcampos `texto`, `select`, `marcar` e `linhas`, cada um com `mostrarSe` comparado ao próprio item). `npm run build:ui` gera `src/server/mcp/ui/generated.ts` (fora do git; limite de 300 KB, hoje ~270 KB), e o recurso é publicado como `ui://contrata/formulario-<hash>.html`. O tema vem do host.

## 6. Como hospedar
Resumo do README (o guia completo entra no 8.12): Supabase com as migrations de `supabase/migrations/`, cliente OAuth do Google próprio, variáveis do `.env.example`. **`CRIACAO_EMPRESA_EMAILS`** decide quem cria empresa (vazia = ninguém); **`MCP_PREVIEW_SECRET`** (32+ caracteres) assina as prévias do fallback; **`PREVIA_PAGINA_SECRET`** (32+) assina o link de pré-visualização da página de carreiras; **`CRON_SECRET`** protege a faxina (`vercel.json` agenda 1×/dia). O conector precisa de HTTPS público: o Claude e o ChatGPT não alcançam `localhost`.

## 7. Divergências em relação ao spec

Todas já refletidas no `spec.md` (v0.4.3).

1. **Clone e use (decisão do Alexandre, 20/11/2026):** saiu o pedido de convite da instância e os limites de SaaS; quem cria empresa é a lista `CRIACAO_EMPRESA_EMAILS` (11.33 reescrita).
2. **Funções do banco por épico:** cada épico cria as funções que usa, com o pgTAP delas.
3. **Funções novas do 8.1:** `rs_fn_aceita_convite`, `rs_fn_reenvia_convite`, `rs_fn_cancela_convite`, `rs_fn_valida_areas`, `rs_fn_garante_administrador` (7.5).
4. **Slugs reservados a mais:** `convite`, `nova`, `conta`, `boas-vindas` (11.20).
5. **Arquivar pessoa responsável de área** deixa a área sem responsável.
6. **`citext` com `search_path = ''`:** o `=` cai no operador de `text`; toda comparação de e-mail nas funções usa `operator(extensions.=)`.
7. **Painel web retirado no 8.2:** saíram `/painel/*`, `/api/painel/*` e o menu lateral; os testes de rota do 8.1 viraram `src/server/mcp/admin.mcp.test.ts`, com todas as asserções.
8. **Corpo do e-mail apagado depois do envio** (20.3).
9. **Um renderizador de formulário, não um HTML por ação (8.2):** o spec pedia `ui/<acao>/` por formulário. Como todos os formulários são campos sobre um schema, o servidor descreve os campos e um HTML genérico os desenha. Menos código, um só limite de 300 KB, e a copy continua no `copy.ts`. Em `src/server/mcp/forms/<acao>/` ficam só `index.ts` (definição: abrir, opções, schema) e `save.ts` (gravação); o fallback é gerado pelo registro comum (`forms/registrar.ts`). Formulários com interação própria (ex.: decisões em lote) podem ganhar HTML dedicado quando chegarem.
10. **Origem do evento vem do ator** (8.2): em vez de mudar a assinatura das funções do 8.1, o ator carrega `origem` e `rs_fn_registra_evento` a respeita.
11. **Criar empresa e Termos no consentimento:** as rotas que eram do painel viraram `/oauth/empresa`, `/oauth/empresa/slug` e `/oauth/termos`.
12. **Sem refresh token:** o token do conector vale até ser revogado (pelo formulário de conexões, ou automaticamente ao mudar o acesso ou remover o membro).
13. **O `scope` do pedido de autorização é ignorado:** quem escolhe os escopos é a pessoa, nas caixas do consentimento (todas marcadas até onde o papel permite); o `decidir` corta pelo papel.
14. **Fallback sem `pendencias`:** a prévia devolve `previa` e `token_previa`; campos que faltam saem como erro de validação, antes da prévia.
15. **`/oauth/autorizar/decidir`** responde erro de requisição no formato do OAuth (`{error}`), como as outras rotas `/oauth/*`, e não no envelope `{codigo, mensagem}` da API.
16. **Acesso sem fallback (decisão do Alexandre, 20/11/2026; spec v0.4.2):** a 13.5 dava prévia com token a todo formulário que não fosse decisão, mas a matriz da seção 5 diz que gerir membros e chaves nunca acontece por chamada de máquina. Valeu a matriz: convite, acesso e conexões não têm `registrar_*`, e `registrar_pessoa` recusa `dar_acesso` (`soNoFormulario` na definição do formulário).
17. **Etapas e perguntas no mesmo formulário `vaga` (8.3)**, com o campo `lista` do formulário genérico; perguntas de vaga publicada aparecem só para leitura e não são regravadas.
18. **Encerrar com candidatura em andamento** ainda não existe (candidaturas chegam no 8.4): o domínio recusa com `vaga_com_ativas` e a API v1 responde 409. O 8.6 troca isso pela decisão com devolutiva e pela proposta 202 da 11.7.
19. **`encerrar_vaga` sem fallback e com escopo `decisao`:** é irreversível e, sem formulário, o próprio modelo confirmaria (mesmo motivo da 13.5). `publicar_vaga` e `pausar_vaga` têm fallback com os nomes gerados `registrar_publicar_vaga` e `registrar_pausar_vaga` (o spec dizia `registrar_publicacao`).
20. **Formulário `pagina_de_carreiras` no 8.3:** publicar e despublicar a página e o link de pré-visualização (HMAC com `PREVIA_PAGINA_SECRET`, 10 min) entraram antes do 8.9, que acrescenta logo, cor e descrição. Sem tipo de evento no catálogo da 15.3, a mudança fica só em `rs_empresas.atualizado_em`.
21. **Aviso ao responsável quando a faxina pausa:** no 8.3 ficam a pausa e o evento `vaga_pausada_prazo`; o aviso sai no resumo diário do 8.10.
22. **"Candidatar-me"** só aparece no 8.4, com a rota de candidatura; o JSON-LD já sai completo (`directApply: true`).
23. **`Idempotency-Key` só no `POST /api/v1/vagas`**, guardada na própria vaga (`rs_vagas.chave_idempotencia`, única por empresa, como no Assina); as outras escritas são idempotentes por natureza.
24. **Página não publicada sem pré-visualização** responde a página 404 do Next com `noindex`, mas com status 200: decidir depende do `?previa=` (dado de requisição), que fica dentro do `Suspense`. Empresa ou vaga inexistente e vaga em rascunho dão 404 de verdade. Os metadados da página não publicada não levam nada da empresa.
25. **`robots.txt` também bloqueia `/dev/`** (host de formulários, que só existe em desenvolvimento).
