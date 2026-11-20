# Documentação técnica — Contrata

Descreve o que está **de fato** implementado, na ordem da seção 19 do `spec.md` (v0.4). Toda mudança de schema, trigger, rota, ferramenta ou lógica de tela atualiza este documento no mesmo commit.

## Estado (20/11/2026)
Épicos 8.0 (guardrails) e 8.1 (fundação) concluídos **no local**. Pendentes do 8.1: migrations no remoto e login real com o cliente Google (ver `plans/8.1-fundacao.md`). **Spec v0.4 (20/11/2026): sistema para agentes, sem painel.** As telas web do 8.1 (seção 4, mapa "Tela → tabelas") são provisórias: saem no 8.2, substituídas por formulários MCP sobre as mesmas funções de domínio. Vagas, candidaturas, API v1 e MCP chegam a partir do 8.2.

---

## 1. Modelo de dados

Todas as tabelas `rs_*` existem desde o 8.1 (migration `20261120180000_rs_schema.sql`), com RLS ligada, nenhuma política e nenhum privilégio para `anon`/`authenticated`: só o servidor, com a service role, lê e escreve (6.5). O schema gerado está em `supabase/schema.sql`.

**Em uso no 8.1** (as demais tabelas existem e ganham uso nos próximos épicos):

| Tabela | O que guarda, em linguagem de negócio |
|---|---|
| `rs_usuarios` | Quem entra no painel. Identificado pelo `google_sub` da conta Google; `email` e `nome` são atualizados a cada login. `termos_aceitos_em` nulo = ainda não passou das boas-vindas. `suspenso_em` preenchido = não entra (suspensão por SQL, feita por quem hospeda) |
| `rs_empresas` | Cada empresa que recruta. `slug` é o endereço da página de carreiras e do painel (`/painel/{slug}`). `email_contato` recebe as respostas dos candidatos. `excluida_em` agenda o expurgo |
| `rs_membros` | Vínculo de uma pessoa com uma empresa. Enquanto `usuario_id` é nulo, é um **convite pendente** (com `convite_token_hash` e `convite_expira_em`). Papel: `administrador` (tudo), `recrutador` (conduz vagas; `todas_areas = false` limita às áreas de `rs_membro_areas`), `avaliador` (só avalia nas vagas em que está). `removido_em` = saiu da empresa |
| `rs_membro_areas` | Áreas de um recrutador limitado |
| `rs_areas` | Departamentos da empresa, um nível. `responsavel_pessoa_id` vira o dono padrão das vagas novas da área. `arquivada_em` = fora das listas |
| `rs_pessoas` | Gente da empresa que participa do recrutamento (gestores, donos de vaga), com ou sem acesso. `membro_id` nulo = **sem acesso**. Todo membro tem uma linha aqui |
| `rs_credenciais` | Chaves de API e tokens MCP (só hash). No 8.1 só é tocada para revogar tokens MCP ao mudar acesso ou remover membro |
| `rs_eventos` | Trilha, só inserção. Cada linha diz o tipo (catálogo fechado da 15.3), o ator (membro, candidato, sistema, api, agente), a origem e `dados` sem dado pessoal (ids, papéis, contagens) |
| `rs_notificacoes` | Fila de e-mail idempotente: cada e-mail tem uma `chave_idempotencia` única; status `pendente` → `enviada` ou `falhou` |

Valores de enum em uso: `rs_papel_membro` (administrador, recrutador, avaliador), `rs_tipo_ator` (membro), `rs_origem_evento` (painel), `rs_tipo_notificacao` (`convite_membro`), `rs_status_notificacao` (pendente, enviada, falhou). Os enums do convite da instância (`rs_status_pedido_convite`, `pedido_convite_*`) **não existem**: saíram no spec v0.3.

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

---

## 4. Mapas

### Tela → tabelas
| Tela | Rota | Lê | Escreve |
|---|---|---|---|
| Entrar | `/entrar` | — | `rs_usuarios` (pelo callback) |
| Convite | `/convite/{token}` | `rs_membros`, `rs_empresas` | `rs_membros`, `rs_pessoas` |
| Boas-vindas | (layout de `/painel`) | `rs_usuarios` | `rs_usuarios.termos_aceitos_em` |
| Empresas | `/painel` | `rs_membros`, `rs_empresas` | — |
| Criar empresa | `/painel/nova` | `rs_empresas` (slug livre) | `rs_empresas`, `rs_membros`, `rs_pessoas` |
| Minha conta | `/painel/conta` | `rs_usuarios` | — |
| Equipe | `/painel/{e}/equipe` | `rs_membros`, `rs_usuarios`, `rs_membro_areas`, `rs_areas` | `rs_membros`, `rs_membro_areas`, `rs_credenciais` (revogação), `rs_notificacoes` |
| Áreas | `/painel/{e}/areas` | `rs_areas`, `rs_pessoas`, `rs_vagas`, `rs_membro_areas` | `rs_areas` |
| Pessoas | `/painel/{e}/pessoas` | `rs_pessoas`, `rs_areas`, `rs_membros`, `rs_vagas` | `rs_pessoas`, `rs_membros` (dar acesso) |
| Início, Vagas, Para confirmar, Banco de talentos, Página de carreiras, Mensagens, Integrações, Empresa | `/painel/{e}/…` | — | — (aviso "ainda sendo construída", com o guardião do papel) |

### Ação → domínio → portas
| Ação | Domínio (`src/server/`) | Painel | API v1 | MCP |
|---|---|---|---|---|
| Entrar | `db/users.enterUser` | `GET /api/auth/google/callback` | — | — |
| Aceitar termos | `db/users.acceptTerms` | `POST /api/painel/conta/boas-vindas` | sem porta (conta do usuário) | sem porta |
| Criar empresa | `org/companies.createCompany` | `POST /api/painel/empresas` | sem porta (13.2) | sem porta |
| Convidar, reenviar, cancelar | `org/members.inviteMember`, `resendInvite`, `cancelInvite` | `/api/painel/{e}/convites…` | sem porta (13.2) | sem porta |
| Aceitar convite | `org/members.acceptInvite` | `POST /api/convite/{token}/aceitar` | — | — |
| Mudar acesso, remover | `org/members.changeAccess`, `removeMember` | `/api/painel/{e}/membros/{id}` | sem porta (13.2) | sem porta |
| Criar, editar, arquivar área | `org/areas.saveArea`, `archiveArea` | `/api/painel/{e}/areas…` | sem porta (13.2) | sem porta |
| Cadastrar, editar, arquivar pessoa; dar acesso | `org/people.savePerson`, `archivePerson`; `org/members.grantAccess` | `/api/painel/{e}/pessoas…` | sem porta (13.2) | sem porta |
| Listar áreas e pessoas | `org/areas.listAreas`, `org/people.listPeople` | telas acima | `GET /areas`, `GET /pessoas` (8.2) | `listar_areas`, `listar_pessoas` (8.2) |

Guardiões: `requireUsuario` (telas e rotas sem empresa), `requireMembro(req, slug, papelMínimo)` (primeira linha de toda rota `/api/painel/{e}/…`), `memberPage(slug, papelMínimo)` (páginas). Os três releem o vínculo no banco a cada requisição; empresa inexistente, de outra pessoa ou sem vínculo dá 404. O alcance (11.32) é calculado em `org/scope.computeScope` e aplicado por `listJobsInScope`.

## 5. Lógica por tela

- **Login** (`/api/auth/google/callback`): confere `state` e PKCE, valida o `id_token` (assinatura, `aud`, `iss`, `email_verified = true`), recusa e-mail de `EMAILS_BLOQUEADOS`, chama `rs_fn_entra_usuario`. Erros: `/entrar?erro=falha|sem_acesso|suspenso|email_em_uso`, cada um com a copy de `copy.login.erros`. Se a volta era um convite que o próprio login aceitou, vai para `/painel`.
- **Empresas** (`/painel`): uma empresa → vai direto; várias → lista; nenhuma → "Você ainda não participa de nenhuma empresa." e, sem permissão de criar, a copy da 15.2.
- **Criar empresa**: sugere o slug a partir do nome; confere formato e reservados na hora e a disponibilidade pelo servidor (`GET /api/painel/empresas/slug`); recusa com "Esse endereço já está em uso. Tente outro." (reservado ou em uso) ou "Use de 3 a 40 letras minúsculas, números e hífens."
- **Equipe**: convidar (e-mail, papel com a explicação da 15.2, áreas só para recrutador: Todas ou Escolher áreas); convite pendente mostra o prazo; reenviar e cancelar; mudar acesso e remover com confirmação no lugar. Erros do banco aparecem na linha (ex.: último administrador).
- **Áreas**: criar e editar (nome, responsável); arquivar com confirmação; recusa com a copy "Arquivar área recusado".
- **Pessoas**: cadastrar e editar (nome, e-mail, cargo, área, resumo semanal); selo "Com acesso · {papel}", "Convite enviado" ou "Sem acesso"; administrador vê "Dar acesso" e "Arquivar".
- **E-mail** `convite_membro`: remetente "{empresa} via Contrata", `reply-to` = e-mail de contato da empresa, link `/convite/{token}`. Sem `RESEND_API_KEY`, em desenvolvimento, vai para `.caixa-de-saida-local/`.

## 6. Como hospedar
Resumo do README (o guia completo entra no 8.12): Supabase com as migrations de `supabase/migrations/`, cliente OAuth do Google próprio, variáveis do `.env.example`. **`CRIACAO_EMPRESA_EMAILS`** decide quem cria empresa (vazia = ninguém).

## 7. Divergências em relação ao spec

Todas já refletidas no `spec.md` v0.3.

1. **Clone e use (decisão do Alexandre, 20/11/2026):** saiu o pedido de convite da instância e os limites de SaaS; quem cria empresa é a lista `CRIACAO_EMPRESA_EMAILS` (11.33 reescrita).
2. **Funções do banco por épico:** o 8.1 criou os triggers de invariante e as funções da administração; as funções de vagas, candidaturas, decisões, mensagens, retenção e faxina entram nas migrations dos épicos que as usam, com o pgTAP delas.
3. **Funções novas:** `rs_fn_aceita_convite`, `rs_fn_reenvia_convite`, `rs_fn_cancela_convite`, `rs_fn_valida_areas`, `rs_fn_garante_administrador` (seção 7.5 atualizada).
4. **Slugs reservados a mais:** `convite`, `nova`, `conta`, `boas-vindas`, que colidiriam com rotas fixas (11.20 atualizada).
5. **Arquivar pessoa responsável de área** deixa a área sem responsável (o spec não dizia).
7. **Painel web provisório (v0.4):** as telas do 8.1 seguem no código até o 8.2, que as troca por formulários no chat; o domínio (`src/server/org/`) e os testes ficam.
8. **Corpo do e-mail apagado depois do envio** (20.3): `rs_notificacoes.html` e `.texto` são esvaziados quando o e-mail sai.
6. **`citext` com `search_path = ''`:** o `=` cai no operador de `text`; toda comparação de e-mail nas funções usa `operator(extensions.=)`. O pgTAP pegou isso.
