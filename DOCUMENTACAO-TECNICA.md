# Documentação técnica — Contrata

Descreve o que está **de fato** implementado, na ordem da seção 19 do `spec.md` (v0.4). Toda mudança de schema, trigger, rota, ferramenta ou lógica de tela atualiza este documento no mesmo commit.

## Estado (22/11/2026)
Épicos 8.0 (guardrails), 8.1 (fundação), 8.2 (o conector), 8.3 (vagas e página de carreiras), 8.4 (candidatura e link de acompanhamento), 8.5 (funil: etapas, avaliações, notas e busca), 8.6 (decisões, devolutivas e mensagens) 8.7 (banco de talentos), 8.8 (webhooks e trilha), 8.9 (empresa, LGPD e configurações), 8.10 (faxina diária), 8.11 (analytics) e **8.12 (página inicial, documentação e entrega)** concluídos no local, com as migrations no remoto (pelo `apply_migration`, mesmo SQL dos arquivos; nenhuma função `rs_` exposta a `anon`/`authenticated`). **Spec v0.4.18: sistema para agentes, sem painel.** Quem recruta conecta o Contrata no Claude ou no ChatGPT (`{site}/mcp`) e, pelo chat, administra a equipe e cria, edita, publica, pausa e encerra vagas; a vaga publicada aparece na página de carreiras, no feed, no sitemap e na API pública. A pessoa se candidata pela página da vaga (upload direto do currículo), acompanha pelo link `/c/{token}` que recebe por e-mail, retira a candidatura, baixa e exclui os dados; a empresa inclui candidatos pelo chat (`adicionar_candidato`) ou pela API v1, e conduz o funil conversando: lista, busca, lê currículos, anota, move de etapa em lote, exporta o CSV, e cada avaliador registra a própria avaliação pelo formulário sem ver a dos outros antes. Pendentes, com o Alexandre: projeto e DNS de vagaaberta.app.br na Vercel, cliente OAuth do Google, bucket R2 e, com eles, o teste no Claude, no ChatGPT, no Teste de Pesquisa Aprimorada do Google e o e-mail real pelo Resend. Reprovar, contratar, encerrar a vaga com pessoas em andamento e reabrir só acontecem com o clique de alguém da equipe no formulário de decisões; integrações e clientes sem formulário criam propostas, que a equipe confirma ou descarta. Toda reprovação leva devolutiva; mensagens saem de modelos editáveis; o candidato pode pedir revisão pelo link. O banco de talentos guarda só quem consentiu, com prazo: a equipe busca e convida para vagas novas, e a pessoa entra, renova ou sai pelo link. Integrações recebem webhooks assinados (HMAC, retentativas, endereço público só) configurados pelo formulário `webhooks`, e sincronizam a trilha por `GET /api/v1/eventos?desde=`; o histórico de cada candidatura diz quem fez cada coisa (pessoa pelo formulário, agente em nome de alguém, integração, sistema, candidato). O administrador configura a empresa pelo chat (logo, cor com contraste conferido, descrição, retenção, banco de talentos, aviso de privacidade) e pode excluí-la, com 7 dias para desfazer pelo conector. Uma faxina diária expira convites e propostas, pausa vagas vencidas, anonimiza candidaturas no fim da retenção (respeitando o banco de talentos) e apaga empresas excluídas, retenta e-mails e webhooks, e manda o resumo diário à equipe e o semanal aos donos de vaga sem acesso. Os eventos de produto da seção 21 vão ao Visão do Produto quando as variáveis existem. A página inicial explica o produto com uma conversa simulada, e `/docs/mcp`, `/docs/api` e `/docs/auto-hospedagem` ensinam a conectar, integrar e hospedar; `/privacidade` e `/termos` são modelos com o operador das variáveis. O que depende de contas reais está em `docs/entrega.md`. Quem hospeda recebe no `ADMIN_EMAIL` os alertas da instância (login com e-mail em uso, passo da faxina que falhou, banco acima de 70% do plano), e os administradores de uma empresa acima de 5 GB recebem o aviso (`src/server/alerts/instance.ts`, pela fila de e-mail, um de cada por dia).

---

## 1. Modelo de dados

Todas as tabelas `rs_*` existem desde o 8.1 (migration `20261120180000_rs_schema.sql`), com RLS ligada, nenhuma política e nenhum privilégio para `anon`/`authenticated`: só o servidor, com a service role, lê e escreve (6.5). O schema gerado está em `supabase/schema.sql`.

**Em uso até o 8.5** (as demais tabelas existem e ganham uso nos próximos épicos):

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
| `rs_candidatos` | A pessoa que se candidata, uma por e-mail normalizado na empresa (nome, e-mail, telefone, LinkedIn, cidade). Anonimizada na exclusão (7.4) |
| `rs_candidaturas` | Pessoa × vaga: etapa, `situacao` (máquina 12.2), `origem` (`pagina`, `api_publica`, `integracao`, `manual`), `token_hash` do link `/c` (só o hash; `anonimizada:{id}` depois da exclusão), `consentimento_versao` (versão do aviso aceito, ou `manual`), `expurgar_em`. Do 8.4: `talentos_pedido` (a caixa do banco de talentos marcada; vira consentimento só na conclusão), `atualizado_em` (8.5, para o `atualizada_desde` da API), **`recebida_em`** (nula até concluir; a empresa só vê as recebidas) e o código de exclusão (`exclusao_codigo_hash`, `exclusao_expira_em`, `exclusao_tentativas`, `exclusao_codigos_hora`, `exclusao_janela_desde`) |
| `rs_respostas` | Respostas às perguntas da vaga; `sinalizada` quando difere da resposta esperada (11.10) |
| `rs_arquivos` | O currículo: `path` no bucket (`{empresa}/{candidatura}/curriculo.pdf|docx`), nome original, tipo conferido pelos bytes, tamanho, sha256, `extracao_status` (`ok`, `sem_texto`, `falhou`) e o texto extraído (até 100.000 caracteres) |
| `rs_avaliacoes` | (8.5) A avaliação de um membro da equipe numa etapa: `recomendacao` (forte sim, sim, não, forte não) e comentário de 10 a 5.000; uma por candidatura, etapa e membro (registrar de novo troca) |
| `rs_notas` | (8.5) Notas internas: texto, `ator_tipo` (`membro`, `agente` em nome do membro ou `api`), membro e credencial |
| `rs_decisoes` | (8.6) Propostas de decisão (reprovar, contratar, encerrar vaga, enviar mensagem) feitas pela API v1 ou pelo `propor_decisao`: `payload`, `justificativa`, quem propôs (tipo, membro, credencial), `status` (pendente, confirmada, descartada, expirada), quem decidiu, `expira_em` (7 dias). Uma pendente por alvo |
| `rs_modelos_mensagem` | (8.6) Modelos personalizados pela empresa (os padrão ficam em `copy.modelos`); sem linha = padrão |
| `rs_convites_talento` | (8.7) Convite do banco de talentos para uma vaga: pessoa, vaga, quem convidou, `expira_em` (30 dias), `usado_em`. O `id` vai no link (`?convite=`); o texto do e-mail não fica (20.3) |
| `rs_mensagens` | Mensagens ao candidato. O corpo guarda `{{link_acompanhamento}}`, nunca o link resolvido (20.3) |
| `rs_tentativas_publicas` | (8.4) Janela deslizante dos limites da 11.14: `chave_hash` (HMAC do IP ou do e-mail com `SESSION_SECRET`; o IP nunca é guardado), `tipo` (`candidatura`, `links`, `links_email`), `criado_em`. A faxina apaga as de mais de 24 h |
| `rs_notificacoes` | Fila de e-mail idempotente: cada e-mail tem uma `chave_idempotencia` única; status `pendente` → `enviada` ou `falhou`. `empresa_id` nulo nos alertas da instância ao `ADMIN_EMAIL` (v0.4.13) |

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

Do 8.4, migrations `20261122090000_rs_candidaturas.sql` e `20261122100000_rs_conclui_candidatura.sql`:

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_fn_conta_tentativa(chave, tipo, limite, janela)` | função | candidatar, "Perdi o link" | Janela deslizante: conta as tentativas da chave na janela e grava a nova se couber; devolve se passou |
| `rs_fn_cria_candidatura(empresa, vaga, candidato, respostas, origem, ator, consentimento, talentos, token_hash, max)` | função | página, API pública, API v1, chat | Só vaga publicada (`vaga_fechada`) e até 10.000 por vaga; upsert do candidato por e-mail; 1ª etapa; respostas com `sinalizada`; consentimento de talentos. Duplicada devolve `{id, existente: true, recebida}` e troca o `token_hash` (o link reenviado é novo) |
| `rs_fn_conclui_candidatura(candidatura, empresa, arquivo, mensagem, notificacao, ator, token_hash)` | função | concluir | Grava o arquivo (se houver), `recebida_em`, o `token_hash` definitivo, a mensagem `confirmacao` (com o placeholder), a notificação e o evento `candidatura_criada`. Idempotente; manual pode vir sem currículo |
| `rs_fn_grava_extracao` / `rs_fn_atualiza_busca` | função | depois da resposta (`after()`) | Texto extraído e status; recalcula o vetor de busca |
| `rs_fn_encerra_candidatura(candidatura, empresa, situacao, ator, motivo, mensagem, dados)` | função | retirar (8.4); decisões (8.6) | Máquina 12.2 genérica: calcula `expurgar_em` pela retenção; `devolutiva_obrigatoria` para reprovar e encerrar pela vaga; recusa candidatura anonimizada e volta para `ativa` (`transicao_proibida`) |
| `rs_fn_anonimiza_candidatura` / `rs_fn_exclui_dados_candidato` | função | excluir meus dados | 7.4: apaga respostas, mensagens, texto e notificações pendentes; anonimiza o candidato; devolve os caminhos para apagar do bucket depois do commit; evento `dados_excluidos` |
| `rs_fn_novo_codigo_exclusao` / `rs_fn_valida_codigo_exclusao` | função | excluir meus dados | Código de 6 dígitos (hash), 10 min, 1 por minuto, 5 por hora, 5 tentativas; devolve `ok`, `aguarde`, `limite_hora`, `errado:N`, `bloqueado` ou `expirado` |
| Correções do verifier (`20261122110000_rs_candidatura_ajustes.sql`) | `create or replace` | — | `rs_fn_cria_candidatura` não altera cadastro existente e guarda `talentos_pedido`; `rs_fn_conclui_candidatura` confere de novo que a vaga está publicada (`vaga_fechada`) e só aí grava o consentimento de talentos e o evento `talentos_consentido` |
| `rs_fn_faxina_candidaturas_abandonadas(lote)` | função | `/api/cron/diario` | Apaga as não recebidas com mais de 24 h e devolve os prefixos para limpar o bucket |
| `rs_fn_transicao_vaga` (refeita) | função | publicar | Agora trava a linha da empresa (`for update`) antes de contar as 50 publicadas; `vaga_com_ativas` conta só candidaturas recebidas |

Do 8.5, migration `20261122120000_rs_funil.sql`:

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_candidaturas.atualizado_em` + `rs_tg_atualizado_em` | coluna e trigger | toda mudança | Filtro `atualizada_desde`; nota e avaliação também tocam a linha |
| `rs_fn_lista_candidaturas(empresa, alcance, filtros, início, limite)` | função | listar, buscar, exportar, opções | Só recebidas e no alcance; filtros `vaga_id`, `etapa_id`, `situacao` (padrão `ativa`, ou `todas`), `sinalizada`, `parada_desde`, `pendente_de` (membro da equipe sem avaliação na etapa atual), `atualizada_desde`, `q` (11.28, `websearch_to_tsquery` + `unaccent`, por relevância e depois chegada) e `ordem` (`chegada` ou `movimentacao`) |
| `rs_fn_move_etapa(ids, empresa, etapa, alcance, ator)` | função | `mover_etapa`, API | 11.30: de 1 a 100, mesma vaga, ativas, no alcance; tudo ou nada (`lote_invalido`, `etapa_de_outra_vaga`, `candidatura_nao_ativa`, `etapa_nao_encontrada`); `movida_em` e evento `etapa_alterada {de, para}` em cada uma; a que já está na etapa fica |
| `rs_fn_adiciona_nota(candidatura, empresa, alcance, texto, ator)` | função | `adicionar_nota`, API | Nota com o tipo do ator; evento `nota_adicionada` sem o texto |
| `rs_fn_registra_avaliacao(candidatura, empresa, etapa, membro, recomendação, comentário, ator)` | função | `salvar_avaliacao` | Só quem está na equipe da vaga (`fora_da_equipe`), só ativa, etapa da mesma vaga, comentário de 10 a 5.000; upsert; evento `avaliacao_registrada {etapa_id, recomendacao}` |

Do 8.6, migration `20261122140000_rs_decisoes.sql`:

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_candidaturas.link_versao`, `revisao_texto` | colunas | — | Versão do link derivado (decisão 1 do 8.6); texto opcional do pedido de revisão (apagado na anonimização) |
| `rs_fn_troca_link(candidatura, empresa, versão, hash)` | função | Perdi o link, duplicada, hash antigo | Sobe a versão e grava o hash do token novo, só se a versão ainda for a lida (troca otimista) |
| `rs_fn_encerra_candidatura` (refeita) | função | toda saída de `ativa` | Devolutiva de 20 a 3.000 conferida aqui (11.5), em todo caminho |
| `rs_fn_alvo_da_decisao` | auxiliar | propor, decidir, confirmar | Se o alvo ainda permite a ação (candidatura ativa e não anonimizada; vaga não encerrada; no alcance) |
| `rs_fn_executa_decisao` | auxiliar | só dentro de decidir e confirmar | Executa: reprovar e contratar (`rs_fn_encerra_candidatura`), encerrar vaga (cada ativa com a própria devolutiva, até 1.000, e depois a vaga) e enviar mensagem |
| `rs_fn_decide(...)` | função | `salvar_decisoes` | Só com um membro como ator (`decisao_so_por_pessoa`); confere o alvo e executa |
| `rs_fn_propoe_decisao(...)` | função | API v1, `propor_decisao` | Só `api` ou `agente`, com credencial; uma pendente por alvo (`proposta_existente`); evento `decisao_proposta`. Nunca executa |
| `rs_fn_confirma_decisao(...)` | função | `salvar_propostas` | Só membro; vencida ou alvo mudado → `expirada` com o motivo, sem executar; senão executa com o texto editado e grava `decisao_confirmada` com quem propôs e quem confirmou (`autorizado_por`) |
| `rs_fn_descarta_decisao` | função | `salvar_propostas` | Só membro; `decisao_descartada` |
| `rs_fn_reabre_candidatura` | função | `salvar_decisoes`, resposta de revisão | 11.23: antes do expurgo, vaga publicada ou pausada; volta para a última etapa; sem e-mail |
| `rs_fn_envia_mensagem` | função | mensagens, decisões | `rs_mensagens` (corpo com `{{link_acompanhamento}}`), notificação e `mensagem_enviada`; cota diária da API (200) quando pedida |
| `rs_fn_pede_revisao` / `rs_fn_responde_revisao` | funções | `/c`, `salvar_resposta_revisao` | 11.13: uma vez, reprovada ou encerrada com a vaga, antes do expurgo; a resposta manda `resposta_revisao` e pode reabrir (só com membro) |
| `rs_fn_faxina_decisoes(lote)` | função | `/api/cron/diario` | Pendentes vencidas viram expiradas (`decisao_expirada`, ator sistema) |

Do 8.7, migrations `20261122160000_rs_talentos.sql` e `20261122170000_rs_talentos_ajustes.sql` (achados do verifier):

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_convites_talento`, `rs_candidatos.talentos_avisado_em` | tabela e coluna | — | Convites (decisão 1 do 8.7); aviso de 30 dias uma vez por período |
| `rs_fn_cria_candidatura` (refeita, com `p_convite` opcional) | função | candidatar | Convite desta empresa, desta vaga, desta pessoa e no prazo → origem `banco_talentos` e convite usado; convite que não vale não é erro |
| `rs_fn_talento_no_alcance` | auxiliar | busca e convite | Alguma candidatura recebida da pessoa numa vaga do alcance; avaliador (equipe) nunca |
| `rs_fn_busca_talentos(empresa, alcance, filtros, início, limite)` | função | `buscar_talentos`, `GET /talentos` | Consentimento válido, não anonimizado, no alcance; `q` e `vaga_anterior` só nas candidaturas recebidas dela em vagas do alcance; `q` com `@` não busca |
| `rs_fn_convida_talento(empresa, candidato, vaga, alcance, ator)` | função | convidar | Vaga publicada do alcance, pessoa no banco e no alcance (`talento_indisponivel`); quem já é candidato volta `ja_candidato`; cria ou reaproveita o convite; `talentos_convidado` |
| `rs_fn_talentos_candidato(candidatura, ação)` | função | `/c` | Entrar, renovar (por `talentos_meses`, zera o aviso) ou sair; eventos do titular |
| `rs_fn_faxina_talentos(lote)` | função | `/api/cron/diario` | Tira quem venceu (`talentos_retirado`, sistema) e devolve quem vence em até 30 dias, marcando o aviso; empresa suspensa ou excluída não avisa (fica para depois) |

Do 8.8, migrations `20261122180000_rs_webhooks.sql` e `20261122190000_rs_webhooks_ajustes.sql` (achados do verifier):

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_eventos_tipo_catalogo` (refeito) | check | todo evento | Catálogo 15.3 + `webhook_criado`, `webhook_editado`, `webhook_removido` (decisão 9 do 8.8) |
| `rs_webhooks_eventos_catalogo`, `rs_webhooks_url_tamanho` | checks | salvar webhook | Eventos só do catálogo 13.4; URL até 500 |
| `rs_fn_tipo_webhook(tipo)` | auxiliar | trigger | Tipo da trilha → tipo do webhook (`vaga_pausada_prazo` → `vaga.pausada`; a exclusão a pedido não duplica: cada candidatura já gera `candidatura_anonimizada`); null = não vira webhook |
| `rs_fn_corpo_webhook(evento, tipo)` | auxiliar | trigger | `{id, tipo, criado_em, empresa_id, dados}`: `dados` do evento + resumo da candidatura (etapa, situação, origem…), da vaga e da decisão. **Sem nome, e-mail, telefone ou texto** |
| `rs_tg_eventos_webhook` | trigger (after insert em `rs_eventos`) | todo evento | Uma entrega por webhook ativo que assina o tipo, na mesma transação; empresa suspensa ou excluída não gera |
| `rs_fn_exige_administrador(empresa, ator)` | auxiliar | salvar/remover | `papel_insuficiente` se o membro do ator não for administrador ativo da empresa |
| `rs_fn_salva_webhook(...)` / `rs_fn_remove_webhook(...)` | funções | `salvar_webhooks` | Até 5 por empresa (`limite_webhooks`); editar mantém o que vier nulo; trilha com o host, sem segredo; remover leva as entregas |
| `rs_fn_reserva_entrega(id, max)` | função | envio | Reserva de 2 min e conta a tentativa; só vencida, não entregue, abaixo do máximo |
| `rs_fn_resultado_entrega(id, status, espera, max, desiste)` | função | envio | 2xx → `entregue`; senão `falhou` com a próxima em `espera`, ou `desistiu` (8 tentativas ou 3 dias) |
| `rs_fn_entregas_vencidas(empresa, lote, max)` | função | envio, faxina | Vencidas pelo relógio do banco (o do servidor pode estar atrás), só de webhook ligado, empresa ativa e abaixo do máximo de tentativas (senão travariam a fila) |
| `rs_fn_desiste_entregas(prazo, max)` | função | `/api/cron/diario` | Pendentes mais velhas que 3 dias (webhook desligado, empresa suspensa) e as que chegaram a 8 tentativas sem resultado → `desistiu` |
| `rs_fn_lista_eventos(empresa, alcance, admin, desde, limite)` | função | `GET /api/v1/eventos` | Trilha crescente depois de `desde`; evento de vaga só no alcance, sem vaga só administrador |

Do 8.9, migrations `20261122200000_rs_empresa.sql` e `20261122210000_rs_empresa_ajustes.sql` (achados do verifier):

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_avisos_privacidade` | tabela | salvar empresa, candidatar | O texto extra que cada `consentimento_versao` representa (a versão é só um hash); único empresa+versão |
| `rs_eventos_tipo_catalogo` (refeito) | check | todo evento | + `empresa_editada`, `empresa_excluida`, `exclusao_desfeita` |
| `rs_tipo_notificacao` | enum | — | + `empresa_excluida` |
| `rs_fn_salva_empresa(empresa, dados, versao_aviso, ator, versao_anterior)` | função | `salvar_empresa`, `pagina_de_carreiras` | Administrador; só os campos que vierem; checks da tabela (retenção 90–365, talentos 6–24, site https, cor #rrggbb); o texto extra novo e o que sai vão para o histórico com as versões; `empresa_editada` com os nomes dos campos mudados |
| `rs_fn_conclui_candidatura` (refeita) | função | concluir candidatura | Confere a empresa ativa com `for share` (serializa com a exclusão, que trava `for update`) |
| `rs_fn_troca_logo(empresa, path, mime, bytes, sha256, ator)` | função | `salvar_empresa` | Uma linha `rs_arquivos` tipo `logo`; devolve o caminho antigo (o servidor apaga) |
| `rs_fn_exclui_empresa(empresa, slug, ator)` | função | `salvar_excluir_empresa` | Administrador, slug igual (`slug_nao_confere`), sem candidatura recebida em andamento (`empresa_com_ativas`) → `excluida_em`; devolve `expurgar_em` (7 dias) |
| `rs_fn_desfaz_exclusao(empresa, ator)` | função | `salvar_desfazer_exclusao` | Administrador, excluída há menos de 7 dias (`prazo_vencido`) |

Do 8.10, migrations `20261122220000_rs_faxina.sql` e `20261122230000_rs_faxina_ajustes.sql` (achados do verifier):

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_notificacoes.remetente_nome` | coluna | `enqueue`, `deliverLater` | O "{empresa} via …" para a retentativa da faxina |
| `rs_mensagens.notificacao_id` | coluna (agora anulável, `on delete set null`) | limpeza e expurgo | Apagar a notificação velha só esquece o vínculo |
| `rs_tipo_notificacao` | enum | — | + `acesso_pedido` |
| `rs_fn_faxina_convites(lote)` | função | faxina | Convite de membro vencido sai (`removido_em`), `convite_cancelado` com `{motivo: venceu}`, ator sistema |
| `rs_candidaturas.expurgada_em`, `rs_arquivos_a_apagar` | coluna e tabela | expurgo | Marca a candidatura expurgada (a do banco de talentos mantém o link); anota o arquivo que o bucket não apagou para a próxima rodada |
| `rs_fn_anonimiza_candidatura(candidatura, empresa, manter_curriculo, origem)` | função (refeita) | expurgo, exclusão a pedido | Marca `expurgada_em`; com `manter_curriculo`, o currículo e o link `/c` ficam (banco de talentos, 11.12) |
| `rs_fn_faxina_expurgos(lote)` | função | faxina | Candidatura com `expurgar_em` vencido → anonimiza (quem tem talentos válido guarda nome, contato e o currículo mais recente); pessoa sem nada vivo e sem consentimento → anonimiza o cadastro e o currículo guardado sai; devolve os caminhos |
| `rs_fn_empresas_a_expurgar(lote)` / `rs_fn_expurga_empresa` (refeita) | funções | faxina | Excluídas há 7+ dias; o expurgo apaga em ordem explícita (a cascata conferia as chaves "no action" a cada passo e falhava com nota de integração, avaliação ou mensagem) |
| `rs_fn_notificacoes_a_retentar(lote, max)` / `rs_fn_limpa_notificacoes(dias, lote)` | funções | faxina | Falhou (ou pendente perdida há 10+ min) abaixo de 5 tentativas, de empresa ativa ou sem empresa (v0.4.13); apaga enviadas e descartadas com mais de 30 dias |
| `rs_fn_resumo_diario(empresa, parada_dias, revisao_dias)` | função | faxina | Por vaga: revisões sem resposta (e atrasadas), paradas, pausada pelo prazo, propostas, o responsável válido; e a equipe que pode receber. Sem nome de candidato |
| `rs_fn_resumo_donos(lote, inicio)` | função | faxina (segunda), paginada | Vagas publicadas ou pausadas de dono sem acesso com `recebe_resumo`: contagens por tipo de etapa, encerradas na semana, contratada, quem conduz |
| `rs_fn_pede_acesso(empresa, pessoa)` | função | `/api/publico/{empresa}/pedir-acesso` | `acesso_pedido`; devolve os administradores a avisar |

---

### Achados do primeiro uso real (v0.4.14)
- `abrir_formulario_decisoes` com `acao: contratar` e `encerrar_vaga: true` monta os dois itens num formulário; o aviso do encerramento não conta quem está sendo contratado.
- `decideNow` executa os itens de encerrar a vaga por último e devolve `contratacao_falhou` neles se uma contratação do mesmo clique falhou; os resultados voltam na ordem dos itens.
- `recruiting/messages.montarCom` recusa (`talentos_sem_consentimento`) mensagem que fala de banco de talentos a quem não tem consentimento válido; vale para decisões, propostas, mensagens e encerramento em lote.
- `lib/nome.nomeLegivel`: nome todo em maiúsculas ou minúsculas vira legível no login (`enterUser`) e no `{{recrutador}}`.
- Títulos e descrições de `listar_propostas` e do formulário de propostas dizem "propostas de decisão" e que não são proposta de emprego.

### Alertas da instância (v0.4.13)
Migration `20261123090000_rs_alertas.sql`:

| Nome | Tipo | Quando roda | O que faz |
|---|---|---|---|
| `rs_notificacoes.empresa_id` | coluna (agora anulável) | `alerts/instance` | Alerta da instância não é de empresa |
| `rs_tipo_notificacao` | enum | — | + `alerta_instancia`, `armazenamento_cheio` |
| `rs_fn_notificacoes_a_retentar(lote, max)` | função (refeita) | faxina | `left join` na empresa: entram as sem empresa |
| `rs_fn_tamanho_banco()` | função (invoker; só `service_role`) | passo `alerta_banco` | `pg_database_size` do banco inteiro, em bytes |

`src/server/alerts/instance.ts`, sempre pela fila (`outbox.enqueue`), com chave por dia (`alerta:{tipo}:…:{dia em FUSO}`), nunca lança e nada pessoal:
- `alertaEmailEmUso` (callback do Google, 6.1): ids de `rs_usuarios` do dono do e-mail e de quem tentou.
- `alertaFaxina` (fim de `runDailyCleanup`, 18): passo e código de cada falha.
- `alertaBanco` (passo `alerta_banco` da faxina, 23.1): `rs_fn_tamanho_banco()` contra 70% de `ALERTA_BANCO_LIMITE_MB` (padrão 500).
- `avisaArmazenamentoCheio` (11.14): ao recusar um currículo acima de 5 GB, aos administradores da empresa (tipo `armazenamento_cheio`).
Os três primeiros vão ao `ADMIN_EMAIL` (tipo `alerta_instancia`, `empresa_id` nulo; a retentativa da faxina os inclui) e não saem sem ela.

## 4. Mapas

### Páginas web (as únicas que sobraram para quem recruta)
| Página | Rota | Lê | Escreve |
|---|---|---|---|
| Início | `/` | — | — (v0.4.15: abertura com a conversa recriada, o problema, no que acreditamos, como funciona, uma vaga do começo ao fim com as telas recriadas, o candidato, pedidos para copiar, para quem e o que não faz, como conectar, integrações e perguntas frequentes; layout, cabeçalho e rodapé em `src/app/(publico)/layout.tsx`) |
| Conectar | `/docs/mcp` | — | — (passo a passo no Claude, no ChatGPT e no Claude Code, com o endereço `{site}/mcp`, escopos, papéis e exemplos) |
| Como hospedar | `/docs/auto-hospedagem` | — | — (v0.4.17: redireciona, permanente, para o README no GitHub; o site não fala de hospedar) |
| Privacidade e Termos | `/privacidade`, `/termos` | `OPERADOR_NOME`, `OPERADOR_CONTATO`, `ADMIN_EMAIL` (`server/org/operador.ts`) | — (modelos; sem o nome, "quem hospeda esta instância") |
| Entrar | `/entrar` | — | `rs_usuarios` (pelo callback) |
| Consentimento do conector | `/oauth/autorizar` | `rs_usuarios`, `rs_membros`, `rs_empresas`, `rs_oauth_clientes` | `rs_usuarios.termos_aceitos_em` (`/oauth/termos`), empresa nova (`/oauth/empresa`), `rs_oauth_codigos` (`/oauth/autorizar/decidir`) |
| Convite | `/convite/{token}` e `/convite/aceito` | `rs_membros`, `rs_empresas` | `rs_membros`, `rs_pessoas` |
| Documentação da API | `/docs/api` | — | — (guia: chave, escopos, convenções, propostas 202, webhooks, trilha, API pública; detalhe no OpenAPI) |
| Página de carreiras | `/{empresa}` | `rs_empresas`, `rs_vagas` (publicadas), `rs_areas` | — (só com `pagina_publicada`; antes, só com `?previa=` assinado) |
| Página da vaga | `/{empresa}/vagas/{slug}` | `rs_vagas`, `rs_areas` | — (publicada com JSON-LD; pausada ou encerrada: 200 sem JSON-LD; rascunho: 404) |
| Candidatar-se | `/{empresa}/vagas/{slug}/candidatar` (`noindex`) | `rs_vagas`, `rs_perguntas`, `rs_empresas` | pelas rotas públicas de candidatura (abaixo) |
| Acompanhamento | `/c/{token}` (`noindex`, `no-referrer`) | `rs_candidaturas`, `rs_mensagens` (sem o link) | `POST /api/c/{token}/retirar`, `/excluir/codigo`, `/excluir`; `GET /api/c/{token}/exportar` |
| Perdi o link | `/c` (todas as empresas) e `/{empresa}/links` | — | `POST /api/publico/links`, `/api/publico/{empresa}/links` (resposta sempre igual) |
| Arquivos locais (só sem `S3_*` e fora de produção) | `/api/dev/arquivos/[...caminho]` | o disco (`.armazenamento-local/`) | PUT com URL assinada por HMAC |
| Feed, sitemap, robots | `/{empresa}/vagas.xml`, `/sitemap.xml`, `/robots.txt` | `rs_empresas`, `rs_vagas` | — (o sitemap traz `/`, as cinco páginas de documentação e legais, as carreiras e as vagas publicadas) |
| Host de formulários (só `NODE_ENV=development`) | `/dev/formularios` | — | — (abre e salva formulários de verdade, com um token local) |

### Ferramentas MCP (`/mcp`)
Consultas (`visibility ["model"]`, só `leitura`): `quem_sou_eu`, `listar_equipe` (avaliador vê só nome e áreas), `listar_areas`, `listar_pessoas` (avaliador vê só nome e área), `listar_vagas` (filtros área, dono, status e cursor; avaliador vê só as vagas da equipe dele), `ver_vaga` (aceita título ou id; traz o endereço público, o link de pré-visualização enquanto a página não está publicada e o que falta para publicar) e `resumo_da_vaga` (só contagens). Do 8.5: `listar_candidaturas` (filtros vaga, etapa, situação, sinalizadas, paradas há N dias — padrão 7 —, pendentes da minha avaliação, ordem), `buscar_candidaturas` (texto, 11.28), `ver_candidatura` (respostas em `conteudo_do_candidato` com o selo "Não atende"; avaliações e notas pela 11.9; sem o texto do currículo), `ler_curriculo` (texto em `conteudo_do_candidato` e link de 5 min), `historico_da_candidatura` (15.3, com quem fez) e `exportar_candidaturas` (recrutador+, CSV da 14.1 com link de 5 min).

Operações (classe O, 11.34; escopo `escrita`, papel ≥ recrutador; `readOnlyHint: false`, `destructiveHint: false`): `mover_etapa` (1 a 100, por id ou nome da pessoa, etapa pelo nome) e `adicionar_nota`. O ator é o agente do token; na trilha, "{cliente} · em nome de {membro}".

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
| `adicionar_candidato` | incluir uma pessoa numa vaga publicada do alcance, com currículo (campo `arquivo`, lido no navegador e enviado em base64, **até 3 MB**); a pessoa recebe "{empresa} incluiu você…" com o link `/c` | recrutador, `escrita` | sim, **sem currículo** (`registrar_adicionar_candidato`; com arquivo: `so_no_formulario`) |
| `avaliacao` | registrar ou trocar a própria avaliação numa etapa: candidatura (as que esperam a sua avaliação), etapa (padrão: a atual), recomendação e comentário | membro da equipe da vaga; papel avaliador e escopo **`leitura`** (11.16), a equipe é conferida no banco | **não** (11.9: a opinião é de quem clica) |
| `decisoes` | reprovar (motivo interno, devolutiva editável com o texto final de cada pessoa), contratar (mensagem opcional), encerrar vaga com ativas (a devolutiva com variáveis vai a cada pessoa) e reabrir; lista fixa de até 50, botão "Reprovar e enviar {n}" / "Confirmar {n}"; cada item à parte | recrutador, **`decisao`** | **não** (11.7) |
| `propostas` | confirmar (com o texto editado) ou descartar as pendentes, com quem propôs, a justificativa e o aviso "Esta proposta não vale mais: …" | recrutador, **`decisao`** | **não** (11.7) |
| `mensagem` | modelo ou texto livre, com as variáveis da 11.29 | recrutador, `escrita` | sim |
| `modelos_mensagem` | editar, criar, voltar ao padrão; prévia com dados fictícios | recrutador, `escrita` | sim |
| `resposta_revisao` | responder o pedido de revisão e, opcionalmente, reabrir (reabrir exige também o escopo `decisao`) | recrutador, `escrita` | sim, **sem reabrir** (`soNoFormulario`) |
| `convidar_para_vaga` | pessoas do banco de talentos (só as válidas, no alcance), vaga publicada e o texto do modelo `convite_vaga`; não cria candidatura | recrutador, `escrita` | sim |
| `empresa` | nome, descrição, site, e-mail de contato, cor (campo `cor`, contraste ≥ 4,5:1 com branco), logo (PNG, JPG ou SVG limpo, até 1 MB), tirar o logo, página publicada, retenção, validade do banco de talentos, mensagens das integrações, texto extra do aviso | administrador, `escrita` | sim, mas **logo e mensagens `direto`** só no formulário |
| `excluir_empresa` | digitar o endereço (slug); recusa com candidatura em andamento | administrador, **`decisao`** | **não** |
| `desfazer_exclusao` | só aparece com a empresa excluída (o conector do administrador vê só ele e `quem_sou_eu`) | administrador, `escrita` | **não** |
| `webhooks` | criar, editar (endereço, eventos, ligado), remover, gerar novo segredo, enviar teste; o segredo só no `structuredContent.segredo`, uma vez; o endereço salvo não volta ao modelo ao abrir (vazio mantém) | administrador, `escrita` | sim, mas **criar, trocar o endereço e gerar segredo** ficam em `soNoFormulario` (o endereço é para onde os dados vão) |
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
| Candidatar (11.2, 11.3) | `recruiting/applications.applyToJob`, `completeApplication` | `/{empresa}/vagas/{slug}/candidatar` → `POST /api/publico/{e}/vagas/{slug}/candidaturas`, PUT no bucket, `POST /api/publico/{e}/candidaturas/{id}/concluir` | `POST /api/v1/candidaturas`, `POST /api/v1/candidaturas/{id}/concluir` | — |
| Incluir candidato | `recruiting/applications.addCandidateManually` | — | — | `salvar_adicionar_candidato`, `registrar_adicionar_candidato` |
| Acompanhar, retirar, baixar, excluir | `requireCandidaturaPorToken`, `situacaoParaCandidato`, `withdraw`, `exportData`, `requestDeletionCode`, `deleteData` | `/c/{token}` e `/api/c/{token}/*` | — | — |
| Perdi o link | `resendLinks` | `/c`, `/{empresa}/links` | — | — |
| Limpar candidaturas abandonadas e tentativas velhas (faxina) | `cleanAbandonedApplications` via `runDailyCleanup` | `GET /api/cron/diario` | — | — |
| Listar, buscar, ver, ler currículo, histórico | `recruiting/pipeline.listApplications`, `getApplication`, `readResume`, `history` | — | `GET /candidaturas`, `/candidaturas/{id}`, `/candidaturas/{id}/curriculo` | `listar_candidaturas`, `buscar_candidaturas`, `ver_candidatura`, `ler_curriculo`, `historico_da_candidatura` |
| Mover de etapa | `recruiting/pipeline.moveStage` | — | `POST /candidaturas/{id}/mover`, `POST /candidaturas/mover` | `mover_etapa` |
| Anotar | `recruiting/pipeline.addNote` | — | `POST /candidaturas/{id}/notas` | `adicionar_nota` |
| Decidir (11.5, 11.7, 11.23) | `recruiting/decisions.decideNow` | — | — (só proposta) | `salvar_decisoes` |
| Propor | `recruiting/decisions.proposeDecision` | — | `POST /candidaturas/{id}/reprovar`, `/contratar` (sempre 202), `POST /vagas/{id}/encerrar` com ativas (202) | `propor_decisao` (só sem formulário) |
| Confirmar ou descartar propostas | `recruiting/decisions.confirmProposals`, `listProposals` | — | `GET /decisoes`, `/decisoes/{id}` (só leitura) | `listar_propostas`, `salvar_propostas` |
| Mensagem ao candidato (11.8) | `recruiting/messages.sendMessage`, `sendMessageFromApi` | — | `POST /candidaturas/{id}/mensagens` (201 direto ou 202 proposta) | `salvar_mensagem`, `registrar_mensagem` |
| Modelos de mensagem | `messages/templates.listTemplates`; `recruiting/messages.saveTemplate`, `resetTemplate`, `previewTemplate` | — | `GET /modelos-mensagem` | `listar_modelos_mensagem`, `salvar_modelos_mensagem` |
| Pedir e responder revisão (11.13) | `recruiting/applications.requestReview`; `recruiting/messages.respondReview` | `POST /api/c/{token}/revisao` | — | `salvar_resposta_revisao` |
| Banco de talentos (8.7) | `recruiting/talents.searchTalents`, `inviteTalents`, `talentAction`, `expiringTalentsDigest` | `/c/{token}` (`POST /api/c/{token}/talentos`), candidatura com `?convite=` | `GET /talentos`, `POST /talentos/{id}/convidar` | `buscar_talentos`, `salvar_convidar_para_vaga` |
| Analytics (8.11; seção 21) | `analytics/client` (`track`, `trackApiCall`, `quemDoAtor`), `analytics/events` (`EVENT_SCHEMAS`, `origemDoAtor`); chamado no domínio (empresa, convite, área, pessoa, chave, vaga, candidatura, funil, avaliação, decisões, /c, OAuth), no `registrarFormulario` e nos guardiões da API v1 e do `/mcp` | — | — | — |
| Faxina diária (8.10) | `server/cron.runDailyCleanup` (ordem da 8.10, orçamento de 45 s, `sobrou` no log); `org/cleanup` (`expireInvites`, `purgeExpired`, `purgeCompanies`); `email/outbox` (`retryNotifications`, `cleanOldNotifications`); `recruiting/digests` (`dailyDigest`, `weeklyOwnerDigest`) | `GET /api/cron/diario` (`CRON_SECRET`) | — | — |
| Pedir acesso (8.10; 11.31) | `org/access-request` (`linkPedirAcesso`, `requestAccess`) | `/{empresa}/pedir-acesso?t=` → `POST /api/publico/{empresa}/pedir-acesso` | — | — |
| Configurar a empresa (8.9) | `org/companies.companySettings`, `saveCompany`, `saveLogo`; logo em `files/logo.ts` (`confereLogo`, `sanitizaSvg`, `urlDoLogo`); contraste em `lib/cor.ts` | `GET /api/publico/{empresa}/logo` | `GET /empresa` (com a configuração; escrita sem porta) | `quem_sou_eu`, `salvar_empresa`, `registrar_empresa` |
| Excluir e desfazer (8.9; 7.4) | `org/companies.deleteCompany`, `restoreCompany`; `auth/credential.resolveCredential` (excluída: só o conector de administrador) | — | — | `salvar_excluir_empresa`, `salvar_desfazer_exclusao` |
| Webhooks (8.8; 11.17) | `webhooks/settings.listWebhooks`, `createWebhook`, `updateWebhook`, `removeWebhook`, `testWebhook`; envio em `webhooks/deliver` (`deliverOne`, `deliverDue`, `deliverDueLater`, `retryWebhooks`, `sendTest`) | — | — (sem porta, 13.2) | `salvar_webhooks`, `registrar_webhooks` |
| Trilha para integrações (8.8) | `audit/events.listEvents` | — | `GET /eventos?desde=&limite=` | `historico_da_candidatura` (por candidatura) |
| Avaliar (11.9) | `recruiting/pipeline.registerEvaluation` | — | — (a API não avalia) | `salvar_avaliacao` |
| Exportar CSV (14.1) | `recruiting/pipeline.exportApplications` | — | — | `exportar_candidaturas` |
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
- **Candidatura (8.4):** a 11.2 é o `candidaturaSchema` de `src/lib/schemas/applications.ts`, o mesmo na página, na API pública, na API v1 e (sem aceite nem respostas) no chat. O `POST` cria a candidatura **não recebida** e devolve `{id, upload_url?, concluir_token}`; o navegador (ou a integração) sobe o arquivo direto no bucket com a URL assinada (1 h) e chama `concluir` com o token (HMAC de 1 h ligado ao id, `exp.ext.sig`). Concluir lê o arquivo do bucket, confere o tipo pelos bytes (`%PDF-`, ou zip com `word/document.xml`) e o tamanho, grava, gera o token `/c` definitivo e manda o e-mail; a extração (unpdf, mammoth; 15 s) roda em `after()`. A empresa nunca vê o token `/c`, nem pela API. Duplicada recebida: 200 `{duplicada: true}` e o link (novo) por e-mail; duplicada não recebida: a mesma candidatura com uma nova URL. Limites da 11.14: 10 por IP por hora (fora da API v1), 10.000 por vaga, 5 GB por empresa e o campo-armadilha `website`; recusa com 429 ou 400 `envio_recusado`, sem dizer o motivo. Origem: `pagina` quando o `Origin` é o próprio site; `api_publica` nos outros; CORS aberto a `https` no `POST`.
- **Link `/c/{token}`:** o guardião `requireCandidaturaPorToken` confere o formato, faz o hash e acha a candidatura de empresa não excluída. Mostra a situação da 11.21 (sem etapas internas) e as mensagens com o placeholder trocado por "este link". Retirar → `desistiu` + e-mail; baixar → JSON da 14.2 (sem nota, avaliação nem motivo); excluir → código por e-mail (endereço mascarado na tela) → anonimização e limpeza do bucket. "Perdi o link" manda um e-mail por empresa, só com os links dela, e troca os tokens; a resposta é sempre a mesma.
- **Armazenamento:** `src/server/files/storage.ts` (`ArquivoStorage`, do Assina). Com `S3_*`, o driver S3 (R2 por padrão); sem, o local em `.armazenamento-local/`, servido pela rota de desenvolvimento com HMAC do `SESSION_SECRET` (404 em produção ou com S3). A origem do `S3_ENDPOINT` entra na CSP (`connect-src`, `img-src`, `frame-src`).
- **Decisões (8.6):** decidir só acontece por `rs_fn_decide` ou `rs_fn_confirma_decisao`, e as duas recusam ator que não seja membro: o clique no formulário. A API v1 e o `propor_decisao` (registrado só quando o cliente não mostra formulários) criam proposta e respondem com a copy da 15.2. Cada item do lote roda à parte (até 50): o que falha volta marcado no item e não desfaz os outros. O texto ao candidato é montado no servidor (`recruiting/messages.montarMensagem`): variáveis da 11.29 (`{{recrutador}}` = quem envia, ou o responsável da vaga quando age agente ou integração), a versão guardada mantém `{{link_acompanhamento}}` e o e-mail leva o link. Os e-mails saem depois do commit, pela chave da notificação. Mensagens pela API seguem `rs_empresas.mensagens_agente` (`confirmar`, padrão, vira proposta; `direto` manda, até 200 por dia vindas de chaves). Faxina: expira as vencidas e manda `decisoes_pendentes` a cada recrutador ou administrador que enxerga alguma pendente há mais de 24 h (uma vez por dia).
- **Link do candidato (8.6):** `messages/link.ts`. O token é `HMAC(LINK_CANDIDATO_SECRET, "{candidatura}:{versão}")`; no banco, só o hash. Todo e-mail recalcula o link. "Perdi o link" e a duplicada giram a versão (`rs_fn_troca_link`). Candidatura com hash que não é o derivado (de antes do 8.6) gira para o derivado antes do e-mail, para o link enviado funcionar.
- **Banco de talentos (8.7):** só aparece quem consentiu e está no prazo, não anonimizado e com alguma candidatura numa vaga do alcance (o avaliador não usa). `buscar_talentos` traz as candidaturas anteriores (para o `ler_curriculo`) e nunca e-mail ou telefone. O convite sai pela fila com o link `/{empresa}/vagas/{slug}/candidatar?convite={id}` e, embaixo, por que a pessoa recebe e o link de acompanhamento para sair do banco. O formulário de candidatura manda o `convite` lido da URL; o banco decide se vale. Faxina: tira quem venceu e manda `talentos_expirando` (link do `/c` para renovar) uma vez, a quem vence em até 30 dias.
- **Funil (8.5):** toda leitura passa por `rs_fn_lista_candidaturas` ou pela vaga (`getJob`, que some com o que está fora do alcance). A visão do avaliador (alcance `equipe`) segue a 11.9: as avaliações dos outros numa etapa só aparecem depois que ele registra a dele nessa etapa, e as notas só depois que ele avalia a etapa atual; no lugar, `avaliacoes_ocultas` e o aviso da 15.2. Recrutador, administrador e a API veem tudo. O texto escrito pelo candidato (respostas e currículo) vai ao modelo dentro de `conteudo_do_candidato`, com o aviso de que é dado, não instrução (20.3). O CSV (14.1) sai com BOM, `;` e datas de Brasília; célula que começa com `=`, `+`, `-` ou `@` ganha um apóstrofo (para a planilha não executar texto do candidato); o arquivo fica em `exportacoes/{dia}/{empresa}/` e a faxina apaga as pastas dos 7 dias anteriores.
- **Faxina** (`/api/cron/diario`, `vercel.json` às 9h UTC = 6h em Brasília): `Bearer CRON_SECRET` comparado em tempo constante; lotes de 200 até ~45 s; log só com contagens.
- **E-mails do candidato (8.4):** `candidatura_recebida` (e a versão manual "{empresa} incluiu você…"), desistência, links reenviados e código de exclusão; mesmo remetente e `reply-to` da empresa, com o rodapé da 15.4. O link `/c` só existe no envio: o corpo guardado tem o placeholder (20.3).
- **E-mail** `convite_membro`: remetente "{empresa} via Contrata", `reply-to` = e-mail de contato da empresa, link `/convite/{token}`. Sem `RESEND_API_KEY`, em desenvolvimento, vai para `.caixa-de-saida-local/`. O corpo é apagado depois do envio.

### Como os formulários são construídos
Um único HTML genérico (`ui/formulario/`), feito com Vite singlefile e sem React, renderiza qualquer formulário a partir da descrição que o servidor manda (`src/lib/formularios.ts`: campos `texto`, `email`, `textarea`, `select`, `radio`, `marcar`, `multipla`, `confirmar`, `numero`, `data`, `arquivo` (8.4: lê o arquivo no navegador, confere tipo e tamanho e manda `{nome, tipo, base64}`) e `lista` — itens que se repetem, com subcampos `texto`, `select`, `marcar` e `linhas`, cada um com `mostrarSe` comparado ao próprio item). `npm run build:ui` gera `src/server/mcp/ui/generated.ts` (fora do git; limite de 300 KB, hoje ~259 KB: o formulário importa só `COPY_FORMULARIO`, exportado à parte do `copy.ts`), e o recurso é publicado como `ui://contrata/formulario-<hash>.html`. O tema vem do host.

## 6. Como hospedar
O passo a passo está no README ("Hospedar a sua instância") e, em página, em `/docs/auto-hospedagem`: projeto Supabase próprio com `supabase db push` das migrations, bucket R2 privado com CORS de `PUT`, Resend com domínio verificado, cliente OAuth do Google com o redirect `/api/auth/google/callback`, Vercel com as variáveis (a tabela do README cobre todas as do `.env.example`, e um teste garante) e o cron do `vercel.json`, a primeira empresa por `CRIACAO_EMPRESA_EMAILS` e os textos legais por `OPERADOR_NOME`/`OPERADOR_CONTATO`. O conector precisa de HTTPS público: o Claude e o ChatGPT não alcançam `localhost`. Dependências e licenças em `THIRD_PARTY_NOTICES.md`.

## 7. Divergências em relação ao spec

Todas já refletidas no `spec.md` (v0.4.18).

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
26. **Markdown, JSON-LD e feed em `src/server/careers/`** (não em `src/server/jobs/`, como na tabela da 11.20): `jobs` já é o nome do domínio de vagas (`src/server/recruiting/jobs.ts`), e a parte pública ficou junta. O sitemap é uma rota (`src/app/sitemap.xml/route.ts`), não `sitemap.ts`, para não consultar o banco no build.
27. **`hiringOrganization` sem `logo`** até o 8.9, quando a empresa ganha logo.
28. **Fallback de vaga (`registrar_vaga`) edita só o que vier e não mexe na equipe** (achado do verifier do 8.3): responsável e avaliadores dão acesso às candidaturas, então seguem a regra da v0.4.2 (nada que mexe em acesso sem formulário; `soNoFormulario`).
29. **Limite de 50 vagas publicadas com trava** (pendência do 8.3, feita no 8.4): `rs_fn_transicao_vaga` trava a linha da empresa antes de contar.
30. **Onde guardar o que o spec não diz (8.4):** o código de exclusão em colunas de `rs_candidaturas`; o limite por IP na tabela `rs_tentativas_publicas` (HMAC do IP, nunca o IP); `rs_candidaturas.recebida_em` separa a candidatura concluída da que parou no upload (9.4).
31. **Concluir com `concluir_token`, não com o cookie `rs_cand_{id}`:** o cookie não chegaria quando o site da empresa chama a API de outro domínio. O token (HMAC, 1 h) vale para a página, a API pública e a API v1, que ganhou `POST /api/v1/candidaturas/{id}/concluir`.
32. **Duplicada que parou no upload** devolve a mesma candidatura com uma nova URL (o "Tentar de novo" da 9.4); a recebida reenvia o link.
33. **Token `/c` trocado no reenvio:** na duplicada e no "Perdi o link", o banco só guarda o hash, então o link reenviado é um token novo e o antigo deixa de valer.
34. **Versão do aviso:** `2026-11-20`, com `+{8 do sha256 do texto extra}` quando a empresa tem texto próprio, calculada na hora; `manual` na candidatura do chat.
35. **Fallback `registrar_adicionar_candidato`** (o spec dizia `registrar_candidato`): o nome sai do registro comum. Vai sem currículo; com arquivo, `so_no_formulario`.
36. **`/c` sem "Pedir revisão" e sem renovar ou sair do banco de talentos:** a revisão só vale para candidatura reprovada ou encerrada (8.6); o banco de talentos é o 8.7. A caixa de consentimento já está no formulário.
37. **"Perdi o link" em `/c` (sem empresa)** manda um e-mail por empresa, cada um só com os links dela (11.27).
38. **Copy sem texto no spec** (e-mails de desistência e de links reenviados, corpo do código de exclusão) escrita no tom da seção 15, em `copy.emailCandidato`.
39. **Ficam para depois:** o aviso ao administrador quando a empresa passa de 5 GB (o upload já é recusado; o aviso vai no resumo do 8.10), o limite de 600 chamadas por minuto da API (8.12) e os eventos de analytics (8.11).
40. **Pré-visualização lê o relógio só na requisição:** `await connection()` antes de conferir o `?previa=` (o Next acusava `Date.now()` no prerender).
41. **Currículo pelo chat até 3 MB** (a 11.2 diz 5 MB): o arquivo vai em base64 no corpo do `/mcp`, e a Vercel recusa corpo acima de 4,5 MB. Pela página, pela API pública e pela v1 (upload direto ao bucket), seguem os 5 MB. Achado do verifier do 8.4.
42. **Banco de talentos só na conclusão e cadastro que não muda** (achados do verifier do 8.4): a caixa marcada fica em `rs_candidaturas.talentos_pedido` e vira consentimento ao concluir; a candidatura abandonada não deixa a pessoa no banco. Candidatura com e-mail já cadastrado não troca nome, telefone, LinkedIn nem cidade, porque o e-mail não é verificado.
43. **O código de exclusão não vai no assunto do e-mail:** o assunto fica guardado na fila depois do envio (só `html` e `texto` são apagados, 20.3).
44. **Limite por vaga recusa como os outros** (`envio_recusado`, 429), sem dizer qual limite.
45. **Pendências conhecidas, registradas:** arquivo que falhar ao apagar na exclusão fica órfão no bucket até a varredura do 8.10; sem `x-forwarded-for`, todos os pedidos dividem a mesma chave de limite (na Vercel o cabeçalho sempre vem); trocar o token `/c` no reenvio invalida o link anterior (documentado na v0.4.4; quem pede recebe o novo por e-mail); `rs_fn_grava_etapas` conta candidaturas não recebidas ao recusar tirar uma etapa; quem souber o e-mail de alguém ainda pode concluir uma candidatura de verdade em nome dessa pessoa marcando o banco de talentos (inerente a não verificar o e-mail; a pessoa recebe o e-mail "Recebemos sua candidatura" e pode excluir os dados pelo link). Os comentários da migration `20261122110000` citam a 11.29 para o banco de talentos; a regra é a 11.12 (o arquivo ficou igual ao SQL aplicado no remoto).
46. **Avaliação sem fallback (8.5):** a 13.3 listava `registrar_avaliacao`, mas a 11.9 diz "avaliação só pelo formulário". Valeu a 11.9: sem formulário, o modelo escreveria a opinião pela pessoa. Cliente sem MCP Apps não avalia.
47. **Quem avalia:** quem está na equipe da vaga (`rs_vaga_equipe`), qualquer papel; administrador fora da equipe recebe `fora_da_equipe`. O formulário pede escopo `leitura` e papel avaliador (11.16: o avaliador tem leitura mais o formulário de avaliação); a trava real é a equipe, no banco. Avalia qualquer etapa da vaga (padrão a atual), uma por etapa, e registrar de novo troca.
48. **Notas também ficam ocultas para o avaliador** até ele avaliar a etapa atual: são opinião da equipe e enviesariam igual às avaliações.
49. **Filtro "paradas" com 7 dias por padrão** (critério do 8.5), ajustável na consulta; os 14 dias da 11.11 seguem no resumo diário.
50. **`rs_candidaturas.atualizado_em`** (coluna nova) para o `atualizada_desde` da `GET /api/v1/candidaturas`.
51. **CSV no armazenamento** (`exportacoes/{dia}/{empresa}/{uuid}.csv`), link de 5 min, apagado pela faxina; só recrutador e administrador exportam; evento `candidaturas_exportadas {vaga_id, n}`. Sem rota da API (a 13.2 não lista).
52. **Ator no histórico:** "{nome} (formulário)", "{cliente OAuth} · em nome de {nome}" ("Agente" sem cliente), "Integração · {chave}", "Sistema", "Candidato". Rótulos dos eventos da 15.3 em `copy.historico`.
53. **Operações são escrita, não destrutivas:** `mover_etapa` e `adicionar_nota` têm `readOnlyHint: false` e `destructiveHint: false` (a 13.3 reserva o destrutivo para arquivar e excluir).
54. **Pendente:** candidatura não recebida (upload parado) segura a etapa até a faxina de 24 h; tirar essa etapa antes disso dá `etapa_com_candidaturas`, mesmo sem candidatura visível.
55. **Busca da API com 50 por página** (11.28), mesmo com `limite` maior (achado do verifier do 8.5).
56. **O avaliador vê quantas avaliações ficaram ocultas** (`avaliacoes_ocultas`) e, no histórico, quem já avaliou ou anotou, mas nunca o conteúdo antes de registrar a dele (11.9).
57. **Nome público Vaga Aberta (25.1, v0.4.6):** tudo o que as pessoas veem usa `NEXT_PUBLIC_NOME_PRODUTO` ou o `NOME_PRODUTO` (padrão "Vaga Aberta" no `copy.ts` e no `vite.config.mts`, que embute o nome no formulário do chat). O nome do servidor MCP é a versão em minúsculas com hífen (`vaga-aberta`). Os nomes internos ficam com "contrata".
58. **Link do candidato derivado (8.6, decidido com o Alexandre):** HMAC de candidatura + versão com `LINK_CANDIDATO_SECRET`, no lugar do token aleatório do 8.4. Assim toda mensagem e devolutiva leva o link (a 11.4 continua: no banco, só o hash). Hash antigo gira na primeira mensagem.
59. **Lote de decisões com itens independentes:** o spec diz "lote até 50"; cada item executa e grava à parte, e o que falha volta com o motivo sem desfazer os outros (como uma proposta que perdeu o alvo).
60. **Encerrar vaga pela API com ativas:** 202 com proposta `encerrar_vaga`, que exige a devolutiva (20+) no corpo; sem ativas, continua 200.
61. **`resposta_revisao` com fallback sem reabrir:** reabrir é decisão (11.23), então só no formulário e com o escopo `decisao`; a mensagem pode ir pelo fallback.
62. **Modelo `contratacao`** (sem texto no spec) e as copies de `revisao_pedida` e `decisoes_pendentes` escritas no tom da 15.4; o modelo `confirmacao` não é personalizável ainda (o e-mail de candidatura recebida segue fixo).
63. **Pendente:** o aviso de revisão vai ao responsável da vaga ou, sem ele, aos administradores; o alerta de prazo de 15 dias para responder fica para o resumo diário do 8.10.
64. **Achados do verifier do 8.6, corrigidos com teste:**
   - encerrar vaga com 100+ pessoas falhava depois do commit, porque a busca das notificações por chave passava do limite de URL; agora entrega em lotes de 50;
   - as mensagens da vaga são montadas de uma vez, com o teto de 1.000 conferido antes;
   - apagar a mensagem ao confirmar uma proposta de contratar passa a valer;
   - encerrar pela API sem devolutiva usa o modelo padrão do motivo (12.1);
   - o banco exige membro também em `rs_fn_reabre_candidatura` e `rs_fn_executa_decisao`, e `rs_fn_confirma_decisao` confere o alcance primeiro (migration `20261122150000_rs_decisoes_ajustes.sql`);
   - filtro por empresa em todas as consultas novas;
   - o aviso de revisão cai para os administradores quando o responsável foi removido.
65. **Cota de mensagens diretas da API** conta só as de chaves (`ator_tipo = 'api'`), como diz a 11.8; tokens do conector não mandam mensagem pela API v1 (a API só aceita chaves).
66. **Convite do banco de talentos numa tabela própria** (`rs_convites_talento`, 30 dias, uso único; convidar de novo reaproveita): o spec só dizia `?convite={id}`. A candidatura pelo link vira `banco_talentos` só com o mesmo e-mail; convite de outra pessoa ou vencido não é erro, a candidatura segue como `pagina`.
67. **O link do convite vai direto para o formulário** (`/candidatar?convite=`), para o parâmetro não se perder na página da vaga.
68. **Alcance do banco de talentos:** como todo consentimento nasce de uma candidatura, vale "se candidatou a alguma vaga do alcance"; o caso "consentiu sem vaga" da 11.32 não existe aqui.
69. **No `/c`, quem não está no banco pode entrar** ("Entrar no banco de talentos", com o texto da caixa do formulário), além de renovar e sair (15.1).
70. **Pendente:** modelo com `{{link_agenda}}` vazio (recrutador sem link de agenda) deixa "por aqui: ." no texto. O formulário de mensagem mostra o texto antes; o ajuste da copy fica para o 8.9 (configurações).
71. **Achados do verifier do 8.7, corrigidos com teste:**
   - a busca por texto e o filtro de vaga anterior olhavam todas as candidaturas da pessoa: agora só as recebidas em vagas do alcance (11.32), senão o texto de uma candidatura de fora virava oráculo;
   - texto com `@` não busca no banco de talentos (o modelo não descobre se um e-mail está lá);
   - `POST /talentos/{id}/convidar` aceita só `{vaga_id}` (13.2) e usa o modelo `convite_vaga` da empresa: texto livre pela API segue a 11.8 em `POST /candidaturas/{id}/mensagens`;
   - um e-mail por convite por dia (convidar de novo no mesmo dia não reenvia);
   - no lote, quem saiu do banco entre abrir e salvar fica de fora e o resumo diz quantos; só dá erro se ninguém pôde ser convidado;
   - convite usado por candidatura não concluída que a faxina apagou volta a valer;
   - o `/c` mostra a quem está fora o texto da caixa do formulário (15.1).
72. **Webhooks nascem no banco** (trigger em `rs_eventos`), não em cada função: nenhum caminho esquece de avisar. A entrega guarda o corpo na hora do evento.
73. **Corpo do webhook sem nome, e-mail ou telefone:** a 13.4 pede "o objeto resumido como na API v1"; aqui vão ids, etapa, situação, origem, datas e o resumo da vaga. Quem integra busca a pessoa em `GET /candidaturas/{id}` com a chave. Assim nada pessoal fica guardado em `rs_entregas_webhook` nem vai para um endereço mal configurado.
74. **Retentativas sem esperar dentro do `after()`:** 1ª tentativa logo depois da resposta; as seguintes (1 min, 10 min, 1 h, depois 1 por dia, até 8 ou 3 dias) saem na próxima atividade da empresa (toda escrita pela API, `/mcp`, e as ações do candidato chamam `deliverDueLater`) ou na faxina diária. A 11.17 fala em "na hora, com `after()`", o que não cabe nos 60 s da Vercel.
75. **Segredo `whsec_` mostrado uma vez** (como a chave de API); para outro, "Gerar novo segredo". O Assina deixa revelar de novo, mas aqui não há painel.
76. **`registrar_webhooks` existe, mas criar, trocar o endereço e gerar segredo são só no formulário** (`soNoFormulario`): o endereço é para onde os dados da empresa vão; um modelo enganado por texto malicioso não escolhe esse destino.
77. **Trilha de webhook:** `webhook_criado`, `webhook_editado`, `webhook_removido` entraram no catálogo 15.3 (v0.4.9), com o host e sem o segredo.
78. **Rótulo de integração no histórico** segue "Integração · {chave}" (8.5, já testado), e não "Integração n8n" como escrito no critério do 8.8.
79. **`GET /eventos`:** a chave de API é da empresa e vê tudo; o filtro de alcance (evento de vaga só no alcance, sem vaga só administrador) vale quando a porta for usada por um membro.
80. **Achados do verifier do 8.8, corrigidos com teste:**
   - webhook desligado, empresa suspensa e entrega no máximo de tentativas travavam a fila (as vencidas vinham sempre primeiro e eram puladas sem mudar): agora ficam fora de `rs_fn_entregas_vencidas`, e a faxina desiste das que morreram no meio com 8 tentativas;
   - os envios têm prazo (40 s por rodada, `WEBHOOK_ORCAMENTO_MS`; um POST só começa se cabem os 10 s dele), na faxina com o que sobra do orçamento;
   - sem `CHAVES_ENC_KEY` nada é reservado (as tentativas não se gastam); segredo que não decifra conta como tentativa sem resposta;
   - o endereço é conferido no DNS já ao salvar (só endereços públicos), além da conexão;
   - abrir o formulário não manda ao modelo o endereço salvo (o caminho pode ter segredo do serviço);
   - a exclusão a pedido não gera um segundo `candidatura.anonimizada`.
81. **O histórico não usa `autorizado_por_membro_id`** (decisão 8 do plano): o "em nome de" sai do `membro_id` do ator agente, e o "confirmado por" do membro que clicou; a coluna fica para a trilha da API (`GET /eventos`).
82. **Logo em `{empresa}/logo-{sha8}.{ext}`** (o spec diz `logo.{ext}`): o hash no nome muda a URL quando o logo muda, e a rota pública serve com cache longo sem mostrar o antigo. SVG limpo com `sanitize-html` (já instalado; o spec cita DOMPurify), lista fechada de elementos e atributos de desenho, só `href` interno (`#id`); SVG que fica sem nada desenhado é recusado. A rota manda `nosniff` e, para SVG, CSP `default-src 'none'; sandbox`.
83. **Retenção (24.6) sem recalcular nada:** `expurgar_em` já é fixado no encerramento com a retenção do momento; mudar a retenção só vale para as próximas encerradas (teste no pgTAP).
84. **Histórico do aviso de privacidade** (`rs_avisos_privacidade`): gravado ao salvar o texto e, para o texto anterior ao 8.9, na primeira candidatura com aquela versão. O JSON do titular (14.2) ganhou `aviso_de_privacidade: {versao, texto_extra}` em cada candidatura.
85. **Excluir exige não ter candidatura em andamento** (decisão do Alexandre, 22/11/2026): cada pessoa recebe a devolutiva pelo fluxo normal (11.5) antes. A confirmação é um campo de texto com o slug (o tipo `confirmar` do formulário segue sendo uma caixa).
86. **Desfazer pelo conector** (decisão do Alexandre): com a empresa excluída, `resolveCredential` aceita só o token do conector de administrador ativo, por 7 dias; o `/mcp` oferece só `quem_sou_eu` (com `expurgar_em`) e `desfazer_exclusao`. O e-mail `empresa_excluida` explica como desfazer. O expurgo no 7º dia (arquivos e linhas) é da faxina do 8.10.
87. **`pagina_de_carreiras` passa pelo `rs_fn_salva_empresa`** e agora gera `empresa_editada`.
88. **Logo nos e-mails ao candidato, nas páginas e no JSON-LD** (`hiringOrganization.logo`), pela URL pública.
89. **Achados do verifier do 8.9, corrigidos com teste:**
   - o SVG perdia `viewBox`, `preserveAspectRatio`, gradientes e `clipPath` (o `sanitize-html` em modo HTML passava tudo para minúsculas): agora em modo XML, com a caixa dos nomes;
   - uma candidatura podia ser concluída numa empresa que acabou de ser excluída: a conclusão confere a empresa e se trava com a exclusão;
   - logo inválido junto com outros campos gravava o resto pela metade: o logo é conferido antes de gravar qualquer coisa;
   - o contraste era arredondado antes de comparar (4,4962 passava): compara-se o número exato;
   - texto extra só com quebras de linha dava erro cru: o texto vai sem espaços nem quebras nas pontas;
   - o texto extra anterior ao 8.9 não tinha histórico: a migration guarda o que existia, e trocar o texto guarda também o que sai.
90. **Desfazer só pelo conector que já estava conectado:** com a empresa excluída, ela não aparece no consentimento do OAuth (não dá para conectar de novo); o e-mail diz isso. Candidatura encerrada com revisão pedida e sem resposta não impede a exclusão (fica para o Alexandre decidir se deveria).
91. **Resumo diário sem as propostas:** o e-mail de propostas pendentes do 8.6 (`decisoes_pendentes`) continua como está; o `resumo_diario` traz candidaturas paradas há 14+ dias, revisões pedidas sem resposta (as de 15+ dias como atrasadas) e vagas pausadas pelo prazo. Num dia com os dois, a pessoa recebe dois e-mails. Os resumos levam só contagens por vaga, sem nome de candidato.
92. **Quem recebe o resumo diário:** o responsável da vaga (membro ativo com conta, administrador ou recrutador); sem ele, administradores e recrutadores cujo alcance inclui a vaga.
93. **Banco de talentos no expurgo (11.12):** a candidatura vencida é anonimizada como qualquer outra; só o currículo da candidatura mais recente e o cadastro (nome, contato) ficam enquanto o consentimento vale. Quando vence, a pessoa é anonimizada e o currículo sai.
94. **"Pedir acesso"** é uma página pública com botão (POST): o link do e-mail traz um token HMAC de 30 dias e um leitor de e-mail que abre links não dispara o pedido. Avisa os administradores uma vez por pessoa por dia; não cria convite.
95. **Achado no caminho:** `rs_fn_expurga_empresa` falhava com nota de integração, avaliação ou mensagem (as chaves "no action" são conferidas a cada passo da cascata); empresas de teste ficavam presas. Agora apaga em ordem explícita, e `rs_mensagens.notificacao_id` ficou anulável com `on delete set null` (a limpeza de notificações velhas também esbarraria nele). Uma empresa que falha não segura as outras.
96. **Pendentes:** varredura de arquivos órfãos no bucket e o aviso de 5 GB por empresa (8.4) não entraram.
97. **Achados do verifier do 8.10, corrigidos com teste:**
   - quem ficava no banco de talentos depois do expurgo perdia o link `/c` (sem aviso de vencimento, sem renovar, sem excluir): a candidatura que guarda o currículo mantém o link, marcada por `expurgada_em`; o link só cai quando a pessoa é anonimizada;
   - só o currículo mais recente fica (os guardados antes saem);
   - o resumo semanal parava no primeiro lote de 200 vagas: agora pagina;
   - arquivo que o bucket não apagou ficava para sempre: vai para `rs_arquivos_a_apagar` e sai na próxima rodada;
   - um passo que falha não derruba os outros (`falharam` no log); o resumo diário e o semanal respeitam o prazo; o expurgo de empresas olha 20 candidatas para uma que falha não segurar as outras;
   - pedir acesso de novo no mesmo dia não repete o evento; a anonimização da faxina grava origem `cron`.
98. **Ainda em aberto (baixos):** `deliver` não reserva a notificação antes de enviar (duas faxinas ao mesmo tempo podem mandar duas vezes); notificações de empresa suspensa não são retentadas nem limpas; a anonimização do cadastro na segunda volta do expurgo não grava evento próprio (o catálogo não tem tipo para isso).
99. **Analytics (8.11) é porte do Assina:** `track()` não espera a rede (depois da resposta), valida no esquema fechado do evento e descarta o que não cabe; sem `VISAO_INGEST_URL` e `VISAO_API_KEY`, nada sai. `distinct_id`: e-mail do membro (pelo membro ou pela credencial do conector, lido depois da resposta), `cand_{id}` do candidato, `emp_{id}` de chave de API e sistema. `origem`: `chat` (formulário), `mcp` (agente e fallback), `api`, `web`, `pagina`, `sistema`.
100. **`editado` do formulário:** o formulário genérico manda `__editado` (comparando o que vai salvar com o que o agente preencheu); o `salvar_*` aceita e tira antes de validar. No fallback, `editado = false`. `editada` da decisão: o texto confirmado difere do proposto (na decisão direta, `false`).
101. **`candidatura_encerrada`** sai da decisão executada (reprovar, contratar, encerrar a vaga: uma por candidatura) e da retirada pelo candidato; o encerramento pela exclusão a pedido conta como `dados_excluidos`. `vaga_publicada` usa a data na chave (republicar é outro evento).
102. **Achados do verifier do 8.11, corrigidos com teste:** "dar acesso" pelo formulário de pessoas não mandava `membro_convidado`; a consulta do `candidatura_encerrada` rodava sempre e fora do `after()` (agora as candidaturas encerradas vêm da própria decisão e o tempo é lido só com analytics ligado, depois da resposta); a candidatura incluída à mão não mandava `candidatura_iniciada`; horas negativas pelo relógio; nome do cliente OAuth vazio ou longo.
103. **Ainda em aberto (baixos):** `cliente` do `mcp_conectado` vem do nome que o cliente OAuth declara no cadastro dinâmico (só o tamanho é conferido); a exclusão a pedido encerra outras candidaturas da pessoa sem `candidatura_encerrada` (conta como `dados_excluidos`, uma vez).
