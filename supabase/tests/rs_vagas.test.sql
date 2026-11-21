-- Vagas (épico 8.3): criar com etapas, perguntas e equipe; alcance (11.32); dono com acesso na
-- equipe (11.31); máquina 12.1; 11.1 de novo no publicar; limite de publicadas (11.14);
-- congelamento de perguntas, etapas e equipe; etapa com candidatura (11.22); faxina (11.11).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p)) $$;
create function pg_temp.etapas() returns jsonb language sql as $$
  select '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista com RH","tipo":"entrevista"},{"nome":"Proposta","tipo":"proposta"}]'::jsonb $$;
create function pg_temp.dados(p_titulo text, p_area text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('titulo', p_titulo, 'area_id', pg_temp.id(p_area), 'modelo_trabalho', 'presencial',
    'cidade', 'Campinas', 'uf', 'SP', 'descricao', repeat('Descrição da vaga com detalhes. ', 3), 'etapas', pg_temp.etapas()) || p_extra $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;

-- Empresa, áreas, membros e pessoas
insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-vg-ana', 'ana-vg@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'vg-padaria', 'Padaria', 'ana-vg@teste.dev');
insert into fx select 'm_ana', id from public.rs_membros where empresa_id = pg_temp.id('e') and usuario_id = pg_temp.id('ana');
insert into fx select 'p_ana', id from public.rs_pessoas where membro_id = pg_temp.id('m_ana');
insert into fx select 'loja', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Loja', null, pg_temp.ator('m_ana'));
insert into fx select 'adm', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Administrativo', null, pg_temp.ator('m_ana'));
insert into fx select 'p_dora', public.rs_fn_salva_pessoa(pg_temp.id('e'), null, 'Dora', 'dora-vg@teste.dev', 'Gerente', pg_temp.id('loja'), true, pg_temp.ator('m_ana'));
select public.rs_fn_salva_area(pg_temp.id('e'), pg_temp.id('loja'), 'Loja', pg_temp.id('p_dora'), pg_temp.ator('m_ana'));
-- Bruno: recrutador limitado à Loja; Caio: avaliador
insert into fx values ('bruno', (public.rs_fn_entra_usuario('sub-vg-bruno', 'bruno-vg@teste.dev', 'Bruno', null) ->> 'usuario_id')::uuid);
insert into fx select 'm_bruno', public.rs_fn_convida_membro(pg_temp.id('e'), 'bruno-vg@teste.dev', 'recrutador', false,
  array[pg_temp.id('loja')], 'h-vg-b', now() + interval '7 days', 50, pg_temp.ator('m_ana'));
select public.rs_fn_aceita_convite(pg_temp.id('m_bruno'), pg_temp.id('bruno'));
insert into fx values ('caio', (public.rs_fn_entra_usuario('sub-vg-caio', 'caio-vg@teste.dev', 'Caio', null) ->> 'usuario_id')::uuid);
insert into fx select 'm_caio', public.rs_fn_convida_membro(pg_temp.id('e'), 'caio-vg@teste.dev', 'avaliador', true,
  '{}', 'h-vg-c', now() + interval '7 days', 50, pg_temp.ator('m_ana'));
select public.rs_fn_aceita_convite(pg_temp.id('m_caio'), pg_temp.id('caio'));
insert into fx select 'p_caio', id from public.rs_pessoas where membro_id = pg_temp.id('m_caio');
create function pg_temp.bruno() returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'areas', 'area_ids', jsonb_build_array(pg_temp.id('loja'))) $$;

-- Criar
insert into fx select 'v1', (public.rs_fn_cria_vaga(pg_temp.id('e'), pg_temp.dados('Atendente de loja', 'loja'),
  pg_temp.todas(), pg_temp.ator('m_ana')) ->> 'id')::uuid;
select is((select status::text from public.rs_vagas where id = pg_temp.id('v1')), 'rascunho', 'vaga nasce em rascunho');
select is((select slug from public.rs_vagas where id = pg_temp.id('v1')), 'atendente-de-loja', 'slug sai do título');
select is((select dono_pessoa_id from public.rs_vagas where id = pg_temp.id('v1')), pg_temp.id('p_dora'), 'dono padrão = responsável da área');
select is((select count(*)::int from public.rs_etapas where vaga_id = pg_temp.id('v1')), 3, 'etapas gravadas');
select is((select count(*)::int from public.rs_eventos where vaga_id = pg_temp.id('v1') and tipo = 'vaga_criada'), 1, 'evento vaga_criada');
select is((public.rs_fn_cria_vaga(pg_temp.id('e'), pg_temp.dados('Atendente de loja', 'loja'), pg_temp.todas(), pg_temp.ator('m_ana')) ->> 'id')::uuid
          is not null, true, 'título repetido cria outra vaga');
select is((select count(*)::int from public.rs_vagas where empresa_id = pg_temp.id('e') and slug = 'atendente-de-loja-2'), 1, 'slug repetido ganha -2');

-- Idempotência
insert into fx select 'vk', (public.rs_fn_cria_vaga(pg_temp.id('e'), pg_temp.dados('Com chave', 'loja'), pg_temp.todas(), pg_temp.ator('m_ana'), 'chave-1') ->> 'id')::uuid;
select is(public.rs_fn_cria_vaga(pg_temp.id('e'), pg_temp.dados('Com chave', 'loja'), pg_temp.todas(), pg_temp.ator('m_ana'), 'chave-1'),
          jsonb_build_object('id', pg_temp.id('vk'), 'criada', false), 'chave repetida devolve a mesma vaga');

-- Alcance (11.32)
select throws_ok(format('select public.rs_fn_cria_vaga(%L, %L, %L, %L)', pg_temp.id('e'), pg_temp.dados('Auxiliar', 'adm'), pg_temp.bruno(), pg_temp.ator('m_bruno')),
                 'P0001', 'fora_do_alcance', 'recrutador limitado não cria vaga fora das áreas dele');
select throws_ok(format('select public.rs_fn_cria_vaga(%L, %L, %L, %L)', pg_temp.id('e'), pg_temp.dados('Sem área', 'loja') || '{"area_id":null}', pg_temp.bruno(), pg_temp.ator('m_bruno')),
                 'P0001', 'fora_do_alcance', 'recrutador limitado não cria vaga "Sem área"');
select lives_ok(format('select public.rs_fn_cria_vaga(%L, %L, %L, %L)', pg_temp.id('e'), pg_temp.dados('Repositor', 'loja'), pg_temp.bruno(), pg_temp.ator('m_bruno')),
                'recrutador limitado cria vaga da área dele');
insert into fx select 'vb', id from public.rs_vagas where empresa_id = pg_temp.id('e') and titulo = 'Repositor';
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('vb'), pg_temp.id('e'),
                 pg_temp.dados('Repositor', 'adm'), pg_temp.bruno(), pg_temp.ator('m_bruno')),
                 'P0001', 'fora_do_alcance', 'trocar para área fora do alcance é recusado');
insert into fx select 'vadm', (public.rs_fn_cria_vaga(pg_temp.id('e'), pg_temp.dados('Auxiliar administrativo', 'adm'), pg_temp.todas(), pg_temp.ator('m_ana')) ->> 'id')::uuid;
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('vadm'), pg_temp.id('e'),
                 pg_temp.dados('Auxiliar administrativo', 'adm'), pg_temp.bruno(), pg_temp.ator('m_bruno')),
                 'P0001', 'nao_encontrado', 'vaga fora do alcance não é encontrada');

-- Dono com acesso entra na equipe (11.31); responsável precisa ser recrutador+
select lives_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                pg_temp.dados('Atendente de loja', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'))), pg_temp.todas(), pg_temp.ator('m_ana')),
                'troca o dono para quem tem acesso');
select is((select papel_na_vaga::text from public.rs_vaga_equipe where vaga_id = pg_temp.id('v1') and membro_id = pg_temp.id('m_caio')), 'avaliador',
          'dono com acesso entra na equipe como avaliador');
select is((select count(*)::int from public.rs_eventos where vaga_id = pg_temp.id('v1') and tipo = 'vaga_dono_alterado'), 1, 'evento vaga_dono_alterado');
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                 pg_temp.dados('Atendente de loja', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'),
                   'equipe', jsonb_build_object('responsavel', pg_temp.id('m_caio')))), pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'responsavel_invalido', 'avaliador não pode ser responsável');
select lives_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                pg_temp.dados('Atendente de loja', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'),
                  'equipe', jsonb_build_object('responsavel', pg_temp.id('m_bruno'), 'avaliadores', '[]'::jsonb))), pg_temp.todas(), pg_temp.ator('m_ana')),
                'equipe com responsável recrutador');
select is((select count(*)::int from public.rs_vaga_equipe where vaga_id = pg_temp.id('v1')), 2,
          'responsável + dono avaliador, mesmo sem o dono na lista');

-- Etapas e perguntas
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                 pg_temp.dados('Atendente de loja', 'loja', '{"etapas":[]}'), pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'etapas_invalidas', 'vaga sem etapa é recusada (11.22)');
select lives_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                pg_temp.dados('Atendente de loja', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'),
                  'perguntas', '[{"texto":"Tem disponibilidade aos sábados?","tipo":"sim_nao","resposta_esperada":"sim"},{"texto":"Turno","tipo":"escolha_unica","opcoes":["Manhã","Tarde"]}]'::jsonb)),
                  pg_temp.todas(), pg_temp.ator('m_ana')),
                'perguntas em rascunho');
select is((select count(*)::int from public.rs_perguntas where vaga_id = pg_temp.id('v1')), 2, 'perguntas gravadas');

-- Máquina 12.1 e 11.1 no publicar
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('v1'), pg_temp.id('e'), 'pausada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'transicao_vaga_proibida', 'rascunho → pausada proibida');
update public.rs_vagas set descricao = 'curta' where id = pg_temp.id('vadm');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('vadm'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'vaga_incompleta', 'descrição curta não publica (11.1)');
update public.rs_vagas set descricao = repeat('x', 60), encerra_em = (now() at time zone 'America/Sao_Paulo')::date - 1 where id = pg_temp.id('vadm');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('vadm'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'encerra_em_passada', 'data-limite passada não publica');
select lives_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('v1'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')),
                'rascunho → publicada');
select isnt((select publicada_em from public.rs_vagas where id = pg_temp.id('v1')), null, 'publicada_em preenchida');
create temp table pub as select publicada_em from public.rs_vagas where id = pg_temp.id('v1');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 1)', pg_temp.id('vk'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'limite_publicadas', 'limite de vagas publicadas (11.14)');

-- Perguntas congeladas, mas o formulário pode devolver as mesmas
select lives_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                pg_temp.dados('Atendente de loja (edição)', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'),
                  'perguntas', '[{"texto":"Tem disponibilidade aos sábados?","tipo":"sim_nao","resposta_esperada":"sim"},{"texto":"Turno","tipo":"escolha_unica","opcoes":["Manhã","Tarde"]}]'::jsonb)),
                  pg_temp.todas(), pg_temp.ator('m_ana')),
                'publicada: o resto muda e as mesmas perguntas passam');
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                 pg_temp.dados('Atendente de loja', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'),
                   'perguntas', '[{"texto":"Outra pergunta?","tipo":"sim_nao"}]'::jsonb)), pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'perguntas_congeladas', 'publicada: perguntas diferentes recusadas (11.1)');
select is((select slug from public.rs_vagas where id = pg_temp.id('v1')), 'atendente-de-loja', 'slug não muda depois de publicar');

-- Pausar, republicar (publicada_em não muda), encerrar
select lives_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('v1'), pg_temp.id('e'), 'pausada', pg_temp.todas(), pg_temp.ator('m_ana')), 'publicada → pausada');
select lives_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('v1'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')), 'pausada → publicada');
select is((select publicada_em from public.rs_vagas where id = pg_temp.id('v1')), (select publicada_em from pub), 'republicar não muda publicada_em');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('v1'), pg_temp.id('e'), 'encerrada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'motivo_obrigatorio', 'encerrar exige motivo');

-- Etapa com candidatura não sai; candidatura ativa impede encerrar (decisão, 8.6)
with x as (insert into public.rs_candidatos (empresa_id, email, nome) values (pg_temp.id('e'), 'cand-vg@teste.dev', 'Pessoa') returning id)
insert into fx select 'cand', id from x;
-- Candidatura recebida (8.4: só a recebida conta como "em andamento").
insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash, consentimento_versao, consentimento_em, recebida_em)
values (pg_temp.id('e'), pg_temp.id('v1'), pg_temp.id('cand'),
        (select id from public.rs_etapas where vaga_id = pg_temp.id('v1') and ordem = 1), 'pagina', 'tok-vg', '2026-11-21', now(), now());
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('v1'), pg_temp.id('e'),
                 pg_temp.dados('Atendente de loja', 'loja', jsonb_build_object('dono_pessoa_id', pg_temp.id('p_caio'),
                   'etapas', '[{"nome":"Só uma","tipo":"entrevista"}]'::jsonb)), pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'etapa_com_candidaturas', 'etapa com candidatura não é excluída (11.22)');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, %L, %L, %L, 50)', pg_temp.id('v1'), pg_temp.id('e'), 'encerrada', 'preenchida', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'vaga_com_ativas', 'encerrar com candidatura ativa é decisão (11.7)');

-- Encerrar sem ativas; encerrada não muda (vaga, etapas, equipe)
select lives_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, %L, %L, %L, 50)', pg_temp.id('vadm'), pg_temp.id('e'), 'encerrada', 'cancelada', pg_temp.todas(), pg_temp.ator('m_ana')),
                'rascunho → encerrada (sem candidaturas)');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('vadm'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'transicao_vaga_proibida', 'encerrada → publicada proibida');
select throws_ok(format('select public.rs_fn_salva_vaga(%L, %L, %L, %L, %L)', pg_temp.id('vadm'), pg_temp.id('e'),
                 pg_temp.dados('Outro', 'adm'), pg_temp.todas(), pg_temp.ator('m_ana')), 'P0001', 'vaga_encerrada', 'encerrada não se edita');
select throws_ok(format($q$update public.rs_etapas set nome = 'Outra' where vaga_id = %L$q$, pg_temp.id('vadm')),
                 'P0001', 'vaga_encerrada', 'etapas de vaga encerrada não mudam');
select throws_ok(format($q$insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga) values (%L, %L, 'avaliador')$q$, pg_temp.id('vadm'), pg_temp.id('m_caio')),
                 'P0001', 'vaga_encerrada', 'equipe de vaga encerrada não muda');
select is((select count(*)::int from public.rs_eventos where vaga_id = pg_temp.id('vadm') and tipo = 'vaga_encerrada'), 1, 'evento vaga_encerrada');

-- Faxina (11.11): pausa a vencida pelo fuso de São Paulo; idempotente
insert into fx select 'vf', (public.rs_fn_cria_vaga(pg_temp.id('e'), pg_temp.dados('Vence ontem', 'loja'), pg_temp.todas(), pg_temp.ator('m_ana')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('vf'), pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m_ana'), 50);
update public.rs_vagas set encerra_em = (now() at time zone 'America/Sao_Paulo')::date - 1 where id = pg_temp.id('vf');
update public.rs_vagas set encerra_em = (now() at time zone 'America/Sao_Paulo')::date where id = pg_temp.id('v1');
select ok(public.rs_fn_faxina_vagas_vencidas(200) >= 1, 'faxina pausou');
select is((select status::text from public.rs_vagas where id = pg_temp.id('vf')), 'pausada', 'vencida ontem fica pausada, não encerrada');
select is((select status::text from public.rs_vagas where id = pg_temp.id('v1')), 'publicada', 'vence hoje continua publicada');
select is((select ator_tipo::text || '/' || origem::text from public.rs_eventos where vaga_id = pg_temp.id('vf') and tipo = 'vaga_pausada_prazo'),
          'sistema/cron', 'evento vaga_pausada_prazo do sistema');
select is((select count(*)::int from public.rs_eventos where vaga_id = pg_temp.id('vf') and tipo = 'vaga_pausada_prazo'), 1, 'rodar de novo não duplica');
select public.rs_fn_faxina_vagas_vencidas(200);
select is((select count(*)::int from public.rs_eventos where vaga_id = pg_temp.id('vf') and tipo = 'vaga_pausada_prazo'), 1, 'segunda rodada não repausa');
select throws_ok(format('select public.rs_fn_transicao_vaga(%L, %L, %L, null, %L, %L, 50)', pg_temp.id('vf'), pg_temp.id('e'), 'publicada', pg_temp.todas(), pg_temp.ator('m_ana')),
                 'P0001', 'encerra_em_passada', 'pausada pelo prazo só volta com data nova (12.1)');

select * from finish();
rollback;
