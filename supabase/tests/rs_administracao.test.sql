-- Administração da empresa (épico 8.1): login e convites (6.1, 11.24), último administrador
-- (11.26), revogação de tokens MCP ao mudar acesso ou remover (6.3), recrutador limitado (11.32),
-- arquivamento de áreas e pessoas (7.4) e ligação pessoa × membro sem duplicar (7.3).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p)) $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-adm-ana', 'ana-adm@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'adm-padaria', 'Padaria', 'ana-adm@teste.dev');
insert into fx select 'm_ana', id from public.rs_membros where empresa_id = pg_temp.id('e') and usuario_id = pg_temp.id('ana');

-- Login
select is((public.rs_fn_entra_usuario('sub-adm-ana', 'ana-adm@teste.dev', 'Ana', null) ->> 'novo')::boolean, false,
          'segundo login não cria outro usuário');
select is((select count(*)::int from public.rs_usuarios where google_sub = 'sub-adm-ana'), 1, 'um usuário por google_sub');
select throws_ok($$select public.rs_fn_entra_usuario('sub-adm-outra', 'ANA-ADM@teste.dev', 'Outra', null)$$,
                 'P0001', 'email_em_uso', 'e-mail de outro usuário é recusado (6.1)');
select is(public.rs_fn_entra_usuario('sub-adm-ana', 'ana-adm@teste.dev', 'Ana', null) -> 'empresas', '["adm-padaria"]'::jsonb,
          'login devolve as empresas do usuário');
select throws_ok($$select public.rs_fn_cria_empresa((select id from fx where k = 'ana'), 'adm-padaria', 'Outra', 'x@teste.dev')$$,
                 'P0001', 'slug_em_uso', 'slug em uso recusado');
select is((select count(*)::int from public.rs_pessoas where empresa_id = pg_temp.id('e') and membro_id = pg_temp.id('m_ana')), 1,
          'quem cria a empresa entra no cadastro de pessoas');

-- Áreas
insert into fx select 'loja', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Loja', null, pg_temp.ator('m_ana'));
insert into fx select 'adm', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Administrativo', null, pg_temp.ator('m_ana'));
select throws_ok($$select public.rs_fn_salva_area((select id from fx where k = 'e'), null, 'LOJA', null, '{"tipo":"membro"}')$$,
                 'P0001', 'area_nome_em_uso', 'nome de área repetido (sem diferenciar maiúsculas)');

-- Convites
select throws_ok(format($$select public.rs_fn_convida_membro(%L, 'bruno-adm@teste.dev', 'recrutador', false, '{}', 'h-b0', now() + interval '7 days', 50, %L)$$,
                 pg_temp.id('e'), pg_temp.ator('m_ana')), 'P0001', 'recrutador_sem_area', 'recrutador limitado sem área recusado (11.32)');
select throws_ok(format($$select public.rs_fn_convida_membro(%L, 'x-adm@teste.dev', 'avaliador', false, %L, 'h-x', now() + interval '7 days', 50, %L)$$,
                 pg_temp.id('e'), array[pg_temp.id('loja')], pg_temp.ator('m_ana')), 'P0001', 'areas_so_para_recrutador_limitado',
                 'áreas só para recrutador limitado');
insert into fx select 'm_bruno', public.rs_fn_convida_membro(pg_temp.id('e'), 'BRUNO-adm@teste.dev', 'recrutador', false,
  array[pg_temp.id('loja')], 'h-b1', now() + interval '7 days', 50, pg_temp.ator('m_ana'));
select throws_ok(format($$select public.rs_fn_convida_membro(%L, 'bruno-adm@teste.dev', 'avaliador', true, '{}', 'h-b2', now() + interval '7 days', 50, %L)$$,
                 pg_temp.id('e'), pg_temp.ator('m_ana')), 'P0001', 'membro_ja_existe', 'e-mail já convidado');
select throws_ok(format($$select public.rs_fn_convida_membro(%L, 'z-adm@teste.dev', 'avaliador', true, '{}', 'h-z', now() + interval '7 days', 1, %L)$$,
                 pg_temp.id('e'), pg_temp.ator('m_ana')), 'P0001', 'limite_convites', 'limite de convites pendentes (11.24)');

-- Pessoa cadastrada antes do convite, depois "Dar acesso"
insert into fx select 'p_dora', public.rs_fn_salva_pessoa(pg_temp.id('e'), null, 'Dora', 'dora-adm@teste.dev', 'Gerente', pg_temp.id('loja'), true, pg_temp.ator('m_ana'));
insert into fx select 'm_dora', public.rs_fn_da_acesso(pg_temp.id('p_dora'), pg_temp.id('e'), 'avaliador', true, '{}', 'h-d', now() + interval '7 days', 50, pg_temp.ator('m_ana'));

-- Convite aceito só com o mesmo e-mail (sem diferenciar maiúsculas)
insert into fx values ('bruno', (public.rs_fn_entra_usuario('sub-adm-bruno', 'bruno-adm@teste.dev', 'Bruno', null) ->> 'usuario_id')::uuid);
select is((select usuario_id from public.rs_membros where id = pg_temp.id('m_bruno')), pg_temp.id('bruno'), 'convite aceito no login (maiúsculas ignoradas)');
select ok((select convite_token_hash is null and convite_expira_em is null from public.rs_membros where id = pg_temp.id('m_bruno')),
          'aceito sem token nem prazo');
select is((select count(*)::int from public.rs_pessoas where empresa_id = pg_temp.id('e') and email = 'bruno-adm@teste.dev'), 1,
          'membro novo ganha uma linha em pessoas');
insert into fx values ('dora', (public.rs_fn_entra_usuario('sub-adm-dora', 'dora-adm@teste.dev', 'Dora', null) ->> 'usuario_id')::uuid);
select is((select count(*)::int from public.rs_pessoas where empresa_id = pg_temp.id('e') and email = 'dora-adm@teste.dev'), 1,
          'pessoa já cadastrada é ligada ao membro sem duplicar');
select is((select membro_id from public.rs_pessoas where id = pg_temp.id('p_dora')), pg_temp.id('m_dora'), 'pessoa ligada ao membro');
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'membro_entrou'), 2,
          'membro_entrou registrado para cada aceite');

insert into fx select 'm_carla', public.rs_fn_convida_membro(pg_temp.id('e'), 'carla-adm@teste.dev', 'avaliador', true, '{}',
  'h-c', now() + interval '7 days', 50, pg_temp.ator('m_ana'));
select throws_ok(format('select public.rs_fn_aceita_convite(%L, %L)', pg_temp.id('m_carla'), pg_temp.id('bruno')),
                 'P0001', 'convite_outro_email', 'convite não é aceito por outra conta (11.24)');
update public.rs_membros set convite_expira_em = now() - interval '1 minute' where id = pg_temp.id('m_carla');
insert into fx values ('carla', (public.rs_fn_entra_usuario('sub-adm-carla', 'carla-adm@teste.dev', 'Carla', null) ->> 'usuario_id')::uuid);
select ok((select usuario_id is null from public.rs_membros where id = pg_temp.id('m_carla')), 'convite vencido não é aceito no login');
select throws_ok(format('select public.rs_fn_aceita_convite(%L, %L)', pg_temp.id('m_carla'), pg_temp.id('carla')),
                 'P0001', 'convite_vencido', 'convite vencido recusado');
select lives_ok(format($$select public.rs_fn_convida_membro(%L, 'carla-adm@teste.dev', 'avaliador', true, '{}', 'h-c2', now() + interval '7 days', 50, %L)$$,
                pg_temp.id('e'), pg_temp.ator('m_ana')), 'convite vencido não impede convidar de novo');

-- Último administrador (11.26)
select throws_ok(format($$select public.rs_fn_muda_acesso(%L, 'recrutador', true, '{}', %L)$$, pg_temp.id('m_ana'), pg_temp.ator('m_ana')),
                 'P0001', 'ultimo_administrador', 'último administrador não é rebaixado');
select throws_ok(format('select public.rs_fn_remove_membro(%L, %L)', pg_temp.id('m_ana'), pg_temp.ator('m_ana')),
                 'P0001', 'ultimo_administrador', 'último administrador não sai');

-- Arquivar área: única área de recrutador limitado (11.32) e vaga aberta (7.4)
select throws_ok(format('select public.rs_fn_arquiva_area(%L, %L, %L)', pg_temp.id('loja'), pg_temp.id('e'), pg_temp.ator('m_ana')),
                 'P0001', 'area_em_uso', 'área única de recrutador limitado não se arquiva');
insert into public.rs_vagas (empresa_id, slug, titulo, modelo_trabalho, area_id, status, publicada_em, dono_pessoa_id)
values (pg_temp.id('e'), 'adm-vaga', 'Vaga', 'remoto', pg_temp.id('adm'), 'publicada', now(), pg_temp.id('p_dora'));
select throws_ok(format('select public.rs_fn_arquiva_area(%L, %L, %L)', pg_temp.id('adm'), pg_temp.id('e'), pg_temp.ator('m_ana')),
                 'P0001', 'area_em_uso', 'área com vaga publicada não se arquiva');
insert into fx select 'vazia', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Vazia', null, pg_temp.ator('m_ana'));
select lives_ok(format('select public.rs_fn_arquiva_area(%L, %L, %L)', pg_temp.id('vazia'), pg_temp.id('e'), pg_temp.ator('m_ana')),
                'área sem vaga aberta se arquiva');

-- Tokens MCP revogados ao mudar acesso e ao remover (6.3)
insert into public.rs_credenciais (empresa_id, tipo, nome, prefixo, valor_hash, escopos, membro_id, criada_por_membro_id)
values (pg_temp.id('e'), 'mcp', 'Claude', 'rsm_aaaa', 'hash-mcp-1', '{leitura,escrita}', pg_temp.id('m_bruno'), pg_temp.id('m_bruno'));
select lives_ok(format($$select public.rs_fn_muda_acesso(%L, 'avaliador', true, '{}', %L)$$, pg_temp.id('m_bruno'), pg_temp.ator('m_ana')),
                'muda papel');
select ok((select revogada_em is not null from public.rs_credenciais where valor_hash = 'hash-mcp-1'), 'mudar papel revoga o token MCP');
select is((select count(*)::int from public.rs_membro_areas where membro_id = pg_temp.id('m_bruno')), 0, 'avaliador fica sem áreas');
insert into public.rs_credenciais (empresa_id, tipo, nome, prefixo, valor_hash, escopos, membro_id, criada_por_membro_id)
values (pg_temp.id('e'), 'mcp', 'Claude', 'rsm_bbbb', 'hash-mcp-2', '{leitura}', pg_temp.id('m_bruno'), pg_temp.id('m_bruno'));
select lives_ok(format('select public.rs_fn_remove_membro(%L, %L)', pg_temp.id('m_bruno'), pg_temp.ator('m_ana')), 'remove membro');
select ok((select revogada_em is not null from public.rs_credenciais where valor_hash = 'hash-mcp-2'), 'remover revoga o token MCP');
select ok((select membro_id is null from public.rs_pessoas where empresa_id = pg_temp.id('e') and email = 'bruno-adm@teste.dev'),
          'pessoa continua, sem acesso');
select lives_ok(format('select public.rs_fn_arquiva_area(%L, %L, %L)', pg_temp.id('loja'), pg_temp.id('e'), pg_temp.ator('m_ana')),
                'sem o recrutador limitado, a área se arquiva');

-- Promover outro administrador permite rebaixar o primeiro
select lives_ok(format($$select public.rs_fn_muda_acesso(%L, 'administrador', true, '{}', %L)$$, pg_temp.id('m_dora'), pg_temp.ator('m_ana')),
                'promove Dora');
select lives_ok(format($$select public.rs_fn_muda_acesso(%L, 'recrutador', true, '{}', %L)$$, pg_temp.id('m_ana'), pg_temp.ator('m_dora')),
                'com outro administrador, Ana pode ser rebaixada');

-- Arquivar pessoa (7.4)
select throws_ok(format('select public.rs_fn_arquiva_pessoa(%L, %L, %L)', pg_temp.id('p_dora'), pg_temp.id('e'), pg_temp.ator('m_ana')),
                 'P0001', 'pessoa_com_acesso', 'pessoa com acesso não se arquiva');
insert into fx select 'p_eva', public.rs_fn_salva_pessoa(pg_temp.id('e'), null, 'Eva', 'eva-adm@teste.dev', null, null, true, pg_temp.ator('m_ana'));
update public.rs_vagas set dono_pessoa_id = pg_temp.id('p_eva') where slug = 'adm-vaga' and empresa_id = pg_temp.id('e');
select throws_ok(format('select public.rs_fn_arquiva_pessoa(%L, %L, %L)', pg_temp.id('p_eva'), pg_temp.id('e'), pg_temp.ator('m_ana')),
                 'P0001', 'pessoa_dona_de_vaga', 'dona de vaga aberta não se arquiva');
select throws_ok(format($$select public.rs_fn_salva_pessoa(%L, %L, 'Dora', 'outra-dora@teste.dev', null, null, true, %L)$$,
                 pg_temp.id('e'), pg_temp.id('p_dora'), pg_temp.ator('m_ana')), 'P0001', 'pessoa_com_acesso_email',
                 'e-mail de pessoa com acesso não muda');

-- Usuário suspenso não entra
update public.rs_usuarios set suspenso_em = now() where id = pg_temp.id('carla');
select throws_ok($$select public.rs_fn_entra_usuario('sub-adm-carla', 'carla-adm@teste.dev', 'Carla', null)$$,
                 'P0001', 'usuario_suspenso', 'usuário suspenso não entra');

-- Nenhum evento carrega e-mail (11.6)
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and dados::text like '%@%'), 0,
          'eventos sem e-mail nos dados');

select * from finish();
rollback;
