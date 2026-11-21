-- Funil (épico 8.5): listar e buscar no alcance (11.28, 11.32), filtros (sinalizada, parada,
-- pendente de avaliação), mover em lote tudo ou nada (11.30), sinalizada não move nada (11.10),
-- nota (11.34) e avaliação só da equipe (11.9), eventos sem texto pessoal (11.6).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p)) $$;
create function pg_temp.agente(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'agente', 'membro_id', pg_temp.id(p), 'origem', 'mcp') $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.vaga(p_titulo text, p_area text, p_equipe jsonb default '{}') returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', p_titulo, 'area_id', pg_temp.id(p_area),
    'modelo_trabalho', 'remoto', 'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4), 'equipe', p_equipe,
    'etapas', '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista","tipo":"entrevista"},{"nome":"Proposta","tipo":"proposta"}]'::jsonb,
    'perguntas', '[{"texto":"Trabalha aos sábados?","tipo":"sim_nao","resposta_esperada":"sim"}]'::jsonb),
    pg_temp.todas(), pg_temp.ator('m_ana')) ->> 'id')::uuid;
  perform public.rs_fn_transicao_vaga(v, pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m_ana'), 50);
  return v;
end $$;
-- Cria e conclui uma candidatura. Recebe: chave, vaga, nome, resposta à pergunta.
create function pg_temp.cand(p_k text, p_vaga text, p_nome text, p_resposta text default 'sim') returns uuid language plpgsql as $$
declare c uuid;
begin
  c := (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id(p_vaga),
    jsonb_build_object('nome', p_nome, 'email', p_k || '@fu.teste.dev'),
    jsonb_build_array(jsonb_build_object('pergunta_id', (select id from public.rs_perguntas where vaga_id = pg_temp.id(p_vaga)), 'valor', p_resposta)),
    'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-' || p_k, 10000) ->> 'id')::uuid;
  perform public.rs_fn_conclui_candidatura(c, pg_temp.id('e'), null, '{"assunto":"a","corpo":"b"}',
    jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', 'rec:' || p_k, 'assunto', 'a', 'html', 'h', 'texto', 't'),
    pg_temp.publico(), 'fin-' || p_k);
  insert into fx values (p_k, c);
  return c;
end $$;
create function pg_temp.etapa(p_vaga text, p_ordem int) returns uuid language sql as $$
  select id from public.rs_etapas where vaga_id = pg_temp.id(p_vaga) order by ordem offset p_ordem - 1 limit 1 $$;
create function pg_temp.lista(p_alcance jsonb, p_filtros jsonb) returns text language sql as $$
  select coalesce(string_agg(nome, ',' order by nome), '') from public.rs_fn_lista_candidaturas(pg_temp.id('e'), p_alcance, p_filtros, 0, 50) $$;

-- Empresa, áreas, membros: Ana (admin), Bruno (recrutador só da Loja), Caio (avaliador, na equipe da v1)
insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-fu-ana', 'ana-fu@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'fu-padaria', 'Padaria', 'ana-fu@teste.dev');
insert into fx select 'm_ana', id from public.rs_membros where empresa_id = pg_temp.id('e') and usuario_id = pg_temp.id('ana');
insert into fx select 'loja', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Loja', null, pg_temp.ator('m_ana'));
insert into fx select 'fin', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Financeiro', null, pg_temp.ator('m_ana'));
insert into fx values ('bruno', (public.rs_fn_entra_usuario('sub-fu-bruno', 'bruno-fu@teste.dev', 'Bruno', null) ->> 'usuario_id')::uuid);
insert into fx select 'm_bruno', public.rs_fn_convida_membro(pg_temp.id('e'), 'bruno-fu@teste.dev', 'recrutador', false,
  array[pg_temp.id('loja')], 'h-fu-b', now() + interval '7 days', 50, pg_temp.ator('m_ana'));
select public.rs_fn_aceita_convite(pg_temp.id('m_bruno'), pg_temp.id('bruno'));
insert into fx values ('caio', (public.rs_fn_entra_usuario('sub-fu-caio', 'caio-fu@teste.dev', 'Caio', null) ->> 'usuario_id')::uuid);
insert into fx select 'm_caio', public.rs_fn_convida_membro(pg_temp.id('e'), 'caio-fu@teste.dev', 'avaliador', true,
  '{}', 'h-fu-c', now() + interval '7 days', 50, pg_temp.ator('m_ana'));
select public.rs_fn_aceita_convite(pg_temp.id('m_caio'), pg_temp.id('caio'));
create function pg_temp.bruno() returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'areas', 'area_ids', jsonb_build_array(pg_temp.id('loja'))) $$;
create function pg_temp.caio() returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'equipe', 'membro_id', pg_temp.id('m_caio')) $$;

insert into fx select 'v1', pg_temp.vaga('Atendente', 'loja', jsonb_build_object('avaliadores', jsonb_build_array(pg_temp.id('m_caio'))));
insert into fx select 'v2', pg_temp.vaga('Analista', 'fin');
select pg_temp.cand('ana_s', 'v1', 'Ana Souza');
select pg_temp.cand('beto', 'v1', 'Beto Lima', 'nao');
select pg_temp.cand('ceci', 'v1', 'Ceci Prado');
select pg_temp.cand('davi', 'v2', 'Davi Rocha');
-- Uma não recebida (upload parado) não aparece para ninguém.
select public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v1'), '{"nome":"Eva Parada","email":"eva@fu.teste.dev"}',
  jsonb_build_array(jsonb_build_object('pergunta_id', (select id from public.rs_perguntas where vaga_id = pg_temp.id('v1')), 'valor', 'sim')),
  'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-eva', 10000);

-- Listar no alcance (11.32)
select is(pg_temp.lista(pg_temp.todas(), '{}'), 'Ana Souza,Beto Lima,Ceci Prado,Davi Rocha', 'admin vê todas as recebidas, nenhuma não recebida');
select is(pg_temp.lista(pg_temp.bruno(), '{}'), 'Ana Souza,Beto Lima,Ceci Prado', 'recrutador limitado não vê outra área');
select is(pg_temp.lista(pg_temp.caio(), '{}'), 'Ana Souza,Beto Lima,Ceci Prado', 'avaliador vê só as vagas da equipe');
select is(pg_temp.lista(pg_temp.todas(), '{"sinalizada":true}'), 'Beto Lima', 'filtro sinalizada (11.10)');
select is(pg_temp.lista(pg_temp.todas(), jsonb_build_object('vaga_id', pg_temp.id('v2'))), 'Davi Rocha', 'filtro de vaga');

-- Busca sem acento (11.28)
select public.rs_fn_atualiza_busca(pg_temp.id('ceci'));
select is(pg_temp.lista(pg_temp.todas(), '{"q":"prado"}'), 'Ceci Prado', 'busca pelo nome');
select is(pg_temp.lista(pg_temp.todas(), '{"q":"souza"}'), 'Ana Souza', 'busca sem acento nem maiúscula');
select is(pg_temp.lista(pg_temp.bruno(), '{"q":"rocha"}'), '', 'a busca respeita o alcance');

-- Mover (11.30)
select throws_ok(format('select public.rs_fn_move_etapa(%L, %L, %L, %L, %L)', array[pg_temp.id('ana_s'), pg_temp.id('davi')],
  pg_temp.id('e'), pg_temp.etapa('v1', 2), pg_temp.todas(), pg_temp.agente('m_ana')), 'P0001', 'etapa_de_outra_vaga', 'lote com outra vaga é recusado');
select is((select count(*)::int from public.rs_candidaturas where id in (pg_temp.id('ana_s'), pg_temp.id('davi')) and etapa_id = pg_temp.etapa('v1', 2)), 0,
  'lote recusado não move nenhuma (tudo ou nada)');
select throws_ok(format('select public.rs_fn_move_etapa(%L, %L, %L, %L, %L)', (select array_agg(gen_random_uuid()) from generate_series(1, 101)),
  pg_temp.id('e'), pg_temp.etapa('v1', 2), pg_temp.todas(), pg_temp.agente('m_ana')), 'P0001', 'lote_invalido', 'mais de 100 é recusado');
select throws_ok(format('select public.rs_fn_move_etapa(%L, %L, %L, %L, %L)', array[pg_temp.id('davi')],
  pg_temp.id('e'), pg_temp.etapa('v2', 2), pg_temp.bruno(), pg_temp.agente('m_bruno')), 'P0001', 'etapa_nao_encontrada', 'recrutador limitado não move em outra área');
update public.rs_candidaturas set movida_em = now() - interval '10 days' where id = pg_temp.id('ana_s');
select is(public.rs_fn_move_etapa(array[pg_temp.id('ana_s'), pg_temp.id('ceci')], pg_temp.id('e'), pg_temp.etapa('v1', 2), pg_temp.bruno(), pg_temp.agente('m_bruno')),
  2, 'move duas no alcance');
select ok((select movida_em > now() - interval '1 minute' from public.rs_candidaturas where id = pg_temp.id('ana_s')), 'movida_em atualizado');
select is((select count(*)::int from public.rs_eventos where candidatura_id = pg_temp.id('ana_s') and tipo = 'etapa_alterada'
  and ator_tipo = 'agente' and origem = 'mcp' and dados ? 'de' and dados ? 'para'), 1, 'evento etapa_alterada do agente com de e para');
select is(public.rs_fn_move_etapa(array[pg_temp.id('ana_s')], pg_temp.id('e'), pg_temp.etapa('v1', 2), pg_temp.todas(), pg_temp.agente('m_ana')),
  0, 'mover para a mesma etapa não faz nada');
-- 11.10: a sinalizada continua na etapa em que estava (nada move por causa da resposta).
select is((select etapa_id from public.rs_candidaturas where id = pg_temp.id('beto')), pg_temp.etapa('v1', 1), 'sinalizada não é movida por nada');
select is((select situacao::text from public.rs_candidaturas where id = pg_temp.id('beto')), 'ativa', 'sinalizada continua ativa');

-- Parada (movida_em antiga)
update public.rs_candidaturas set movida_em = now() - interval '9 days' where id = pg_temp.id('beto');
select is(pg_temp.lista(pg_temp.todas(), jsonb_build_object('parada_desde', now() - interval '7 days')), 'Beto Lima', 'filtro paradas');

-- Nota (11.34)
select isnt(public.rs_fn_adiciona_nota(pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.bruno(), 'Boa experiência em balcão', pg_temp.agente('m_bruno')), null, 'agente anota');
select is((select ator_tipo::text || '/' || (membro_id = pg_temp.id('m_bruno'))::text from public.rs_notas where candidatura_id = pg_temp.id('ana_s')),
  'agente/true', 'a nota guarda o agente e o membro');
select is((select dados::text not like '%balcão%' from public.rs_eventos where candidatura_id = pg_temp.id('ana_s') and tipo = 'nota_adicionada'), true,
  'o evento não leva o texto da nota (11.6)');
select throws_ok(format('select public.rs_fn_adiciona_nota(%L, %L, %L, %L, %L)', pg_temp.id('davi'), pg_temp.id('e'), pg_temp.bruno(), 'x', pg_temp.agente('m_bruno')),
  'P0001', 'nao_encontrado', 'nota fora do alcance é recusada');
select throws_ok(format('select public.rs_fn_adiciona_nota(%L, %L, %L, %L, %L)', pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.todas(), '   ', pg_temp.agente('m_ana')),
  'P0001', 'nota_invalida', 'nota vazia é recusada');

-- Avaliação (11.9)
select is(pg_temp.lista(pg_temp.caio(), jsonb_build_object('pendente_de', pg_temp.id('m_caio'))), 'Ana Souza,Beto Lima,Ceci Prado', 'pendentes do avaliador');
select throws_ok(format('select public.rs_fn_registra_avaliacao(%L, %L, %L, %L, %L, %L, %L)', pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.etapa('v1', 2),
  pg_temp.id('m_bruno'), 'sim', 'Gostei bastante da conversa.', pg_temp.ator('m_bruno')), 'P0001', 'fora_da_equipe', 'quem não está na equipe não avalia');
select throws_ok(format('select public.rs_fn_registra_avaliacao(%L, %L, %L, %L, %L, %L, %L)', pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.etapa('v1', 2),
  pg_temp.id('m_caio'), 'sim', 'curto', pg_temp.ator('m_caio')), 'P0001', 'comentario_invalido', 'comentário com menos de 10 caracteres');
select throws_ok(format('select public.rs_fn_registra_avaliacao(%L, %L, %L, %L, %L, %L, %L)', pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.etapa('v2', 1),
  pg_temp.id('m_caio'), 'sim', 'Gostei bastante da conversa.', pg_temp.ator('m_caio')), 'P0001', 'etapa_de_outra_vaga', 'etapa de outra vaga');
select isnt(public.rs_fn_registra_avaliacao(pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.etapa('v1', 2), pg_temp.id('m_caio'), 'sim',
  'Gostei bastante da conversa.', pg_temp.ator('m_caio')), null, 'avaliador da equipe avalia');
select lives_ok(format('select public.rs_fn_registra_avaliacao(%L, %L, %L, %L, %L, %L, %L)', pg_temp.id('ana_s'), pg_temp.id('e'), pg_temp.etapa('v1', 2),
  pg_temp.id('m_caio'), 'forte_sim', 'Mudei de ideia: excelente.', pg_temp.ator('m_caio')), 'avaliar de novo troca a avaliação');
select is((select count(*)::int || '/' || max(recomendacao::text) from public.rs_avaliacoes where candidatura_id = pg_temp.id('ana_s')), '1/forte_sim',
  'uma avaliação por etapa por membro (upsert)');
select is((select string_agg(dados ->> 'recomendacao', ',') from public.rs_eventos where candidatura_id = pg_temp.id('ana_s') and tipo = 'avaliacao_registrada'),
  'sim,forte_sim', 'evento com a recomendação, sem o comentário');
select is(pg_temp.lista(pg_temp.caio(), jsonb_build_object('pendente_de', pg_temp.id('m_caio'))), 'Beto Lima,Ceci Prado', 'avaliada sai das pendentes');
select ok((select atualizado_em > now() - interval '1 minute' from public.rs_candidaturas where id = pg_temp.id('ana_s')), 'avaliação toca atualizado_em');

-- Candidatura não ativa: não move nem avalia
select public.rs_fn_encerra_candidatura(pg_temp.id('ceci'), pg_temp.id('e'), 'desistiu', pg_temp.publico(), null, null);
select throws_ok(format('select public.rs_fn_move_etapa(%L, %L, %L, %L, %L)', array[pg_temp.id('ceci')], pg_temp.id('e'), pg_temp.etapa('v1', 3),
  pg_temp.todas(), pg_temp.agente('m_ana')), 'P0001', 'candidatura_nao_ativa', 'não move candidatura encerrada');
select throws_ok(format('select public.rs_fn_registra_avaliacao(%L, %L, %L, %L, %L, %L, %L)', pg_temp.id('ceci'), pg_temp.id('e'), pg_temp.etapa('v1', 2),
  pg_temp.id('m_caio'), 'sim', 'Gostei bastante da conversa.', pg_temp.ator('m_caio')), 'P0001', 'candidatura_nao_ativa', 'não avalia candidatura encerrada');
select is(pg_temp.lista(pg_temp.todas(), '{"situacao":"desistiu"}'), 'Ceci Prado', 'filtro de situação');

select * from finish();
rollback;
