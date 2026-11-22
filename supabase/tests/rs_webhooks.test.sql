-- Webhooks (épico 8.8): a entrega nasce com o evento, só para webhook ativo que assina o tipo e
-- empresa ativa; mapa da trilha para o catálogo 13.4; corpo sem nome, e-mail ou telefone; até 5
-- por empresa, eventos do catálogo, só administrador; reserva única; calendário de retentativa e
-- desistência (12.4); trilha das mudanças sem o segredo.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p), 'origem', 'formulario') $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.salva(p_url text, p_eventos text[], p_ativo boolean default true) returns uuid language sql as $$
  select public.rs_fn_salva_webhook(pg_temp.id('e'), null, p_url, p_eventos, p_ativo, 'iv.tag.cifra', 5, pg_temp.ator('m')) $$;
create function pg_temp.entregas(p_webhook text, p_tipo text) returns int language sql as $$
  select count(*)::int from public.rs_entregas_webhook where webhook_id = pg_temp.id(p_webhook) and tipo = p_tipo $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-wh-ana', 'ana-wh@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'wh-padaria', 'Padaria', 'ana-wh@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e');

-- Configurar
insert into fx select 'w_tudo', pg_temp.salva('https://hooks.exemplo.dev/a', array['vaga.publicada', 'vaga.pausada', 'candidatura.criada', 'candidatura.etapa_alterada']);
insert into fx select 'w_cand', pg_temp.salva('https://hooks.exemplo.dev/b', array['candidatura.criada']);
insert into fx select 'w_off', pg_temp.salva('https://hooks.exemplo.dev/c', array['vaga.publicada'], false);
select throws_ok(format('select public.rs_fn_salva_webhook(%L, null, %L, %L, true, %L, 5, %L)', pg_temp.id('e'), 'https://x.dev', '{vaga.qualquer}', 'c',
  pg_temp.ator('m')), '23514', null, 'evento fora do catálogo 13.4 recusado');
select throws_ok(format('select public.rs_fn_salva_webhook(%L, null, %L, %L, true, %L, 5, %L)', pg_temp.id('e'), 'http://x.dev', '{vaga.publicada}', 'c',
  pg_temp.ator('m')), '23514', null, 'só https');
select throws_ok(format('select public.rs_fn_salva_webhook(%L, null, %L, %L, true, %L, 5, %L)', pg_temp.id('e'), 'https://x.dev', '{vaga.publicada}', 'c',
  jsonb_build_object('tipo', 'membro', 'membro_id', gen_random_uuid())), 'P0001', 'papel_insuficiente', 'quem não é administrador da empresa não configura');
select pg_temp.salva('https://hooks.exemplo.dev/d', array['vaga.encerrada']);
select pg_temp.salva('https://hooks.exemplo.dev/e', array['vaga.encerrada']);
select throws_ok(format('select public.rs_fn_salva_webhook(%L, null, %L, %L, true, %L, 5, %L)', pg_temp.id('e'), 'https://x.dev', '{vaga.publicada}', 'c',
  pg_temp.ator('m')), 'P0001', 'limite_webhooks', 'sexto webhook recusado');
select is((select dados::text like '%iv.tag%' from public.rs_eventos where tipo = 'webhook_criado' and empresa_id = pg_temp.id('e') limit 1), false,
  'a trilha não leva o segredo');
select is((select dados ->> 'host' from public.rs_eventos where tipo = 'webhook_criado' and empresa_id = pg_temp.id('e') order by id limit 1),
  'hooks.exemplo.dev', 'a trilha leva o host');

-- A entrega nasce com o evento
insert into fx select 'area', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Loja', null, pg_temp.ator('m'));
insert into fx select 'v', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Vaga de caixa', 'area_id', pg_temp.id('area'),
  'modelo_trabalho', 'remoto', 'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4),
  'etapas', '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista","tipo":"entrevista"}]'::jsonb), pg_temp.todas(), pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v'), pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m'), 50);
select is(pg_temp.entregas('w_tudo', 'vaga.publicada'), 1, 'vaga publicada gera entrega para quem assina');
select is(pg_temp.entregas('w_cand', 'vaga.publicada'), 0, 'quem não assina o tipo não recebe');
select is(pg_temp.entregas('w_off', 'vaga.publicada'), 0, 'webhook desligado não recebe');
select is(public.rs_fn_tipo_webhook('vaga_pausada_prazo'), 'vaga.pausada', 'pausa pelo prazo vira vaga.pausada');
select is(public.rs_fn_tipo_webhook('nota_adicionada'), null, 'nota não vira webhook');
select is(public.rs_fn_tipo_webhook('dados_excluidos'), null, 'exclusão a pedido não duplica: cada candidatura já gera candidatura_anonimizada (achado A3)');

insert into fx select 'c', (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v'), '{"nome":"Bia Souza","email":"bia@wh.teste.dev","telefone":"11999990000"}',
  '[]', 'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-wh-' || gen_random_uuid(), 10000) ->> 'id')::uuid;
select is(pg_temp.entregas('w_cand', 'candidatura.criada'), 0, 'candidatura não concluída ainda não avisa');
select public.rs_fn_conclui_candidatura(pg_temp.id('c'), pg_temp.id('e'), null, '{"assunto":"a","corpo":"b"}',
  jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', 'rec:' || pg_temp.id('c'), 'assunto', 'a', 'html', 'h', 'texto', 't'),
  pg_temp.publico(), 'fin-' || pg_temp.id('c'));
select is(pg_temp.entregas('w_cand', 'candidatura.criada'), 1, 'concluir avisa candidatura.criada');
select is((select corpo::text ~ '(Bia|bia@|11999990000)' from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_cand')), false,
  'corpo sem nome, e-mail ou telefone');
select is((select corpo -> 'dados' -> 'candidatura' ->> 'id' from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_cand')), pg_temp.id('c')::text,
  'corpo com a candidatura resumida');
select is((select corpo -> 'dados' -> 'vaga' ->> 'titulo' from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_cand')), 'Vaga de caixa',
  'e a vaga');
select is((select corpo ->> 'tipo' from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_cand')), 'candidatura.criada', 'tipo do catálogo no corpo');

-- Empresa suspensa não gera entrega
update public.rs_empresas set suspensa_em = now() where id = pg_temp.id('e');
select public.rs_fn_registra_evento(pg_temp.id('e'), pg_temp.id('v'), null, 'vaga_pausada', pg_temp.ator('m'), 'web', '{}');
select is(pg_temp.entregas('w_tudo', 'vaga.pausada'), 0, 'empresa suspensa não gera entrega');
update public.rs_empresas set suspensa_em = null where id = pg_temp.id('e');

-- Reserva e retentativa (12.4)
insert into fx select 'ent', id from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_tudo') and tipo = 'vaga.publicada';
select is(public.rs_fn_reserva_entrega(pg_temp.id('ent'), 8), true, 'reserva');
select is(public.rs_fn_reserva_entrega(pg_temp.id('ent'), 8), false, 'segunda reserva recusada enquanto vale');
select is(public.rs_fn_resultado_entrega(pg_temp.id('ent'), 500, interval '1 minute', 8, interval '3 days')::text, 'falhou', '500 = falhou');
select is((select proxima_tentativa_em > now() + interval '50 seconds' from public.rs_entregas_webhook where id = pg_temp.id('ent')), true, 'próxima em 1 min');
select is(public.rs_fn_reserva_entrega(pg_temp.id('ent'), 8), false, 'antes da hora não reserva');
update public.rs_entregas_webhook set proxima_tentativa_em = now() where id = pg_temp.id('ent');
select is(public.rs_fn_reserva_entrega(pg_temp.id('ent'), 8), true, 'na hora reserva de novo');
select is(public.rs_fn_resultado_entrega(pg_temp.id('ent'), 204, interval '10 minutes', 8, interval '3 days')::text, 'entregue', '2xx = entregue');
select is((select tentativas from public.rs_entregas_webhook where id = pg_temp.id('ent')), 2::smallint, 'duas tentativas');
select is(public.rs_fn_reserva_entrega(pg_temp.id('ent'), 8), false, 'entregue não reserva');

insert into fx select 'ent2', id from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_cand');
update public.rs_entregas_webhook set tentativas = 8 where id = pg_temp.id('ent2');
select is(public.rs_fn_resultado_entrega(pg_temp.id('ent2'), 0, interval '1 hour', 8, interval '3 days')::text, 'desistiu', 'desiste em 8 tentativas');
select is((select ultimo_status_http from public.rs_entregas_webhook where id = pg_temp.id('ent2')), null, 'sem resposta fica nulo');

insert into fx select 'ent3', id from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_tudo') and tipo = 'candidatura.criada';
update public.rs_entregas_webhook set criado_em = now() - interval '4 days' where id = pg_temp.id('ent3');
select is(public.rs_fn_desiste_entregas(interval '3 days') >= 1, true, 'faxina desiste das velhas');
select is((select status::text from public.rs_entregas_webhook where id = pg_temp.id('ent3')), 'desistiu', 'velha desistiu');

-- Editar e remover
select public.rs_fn_salva_webhook(pg_temp.id('e'), pg_temp.id('w_off'), null, null, true, null, 5, pg_temp.ator('m'));
select is((select ativo from public.rs_webhooks where id = pg_temp.id('w_off')), true, 'editar liga sem mexer no resto');
select is((select url from public.rs_webhooks where id = pg_temp.id('w_off')), 'https://hooks.exemplo.dev/c', 'URL fica');
select public.rs_fn_remove_webhook(pg_temp.id('e'), pg_temp.id('w_tudo'), pg_temp.ator('m'));
select is((select count(*)::int from public.rs_entregas_webhook where webhook_id = pg_temp.id('w_tudo')), 0, 'remover leva as entregas');
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo in ('webhook_editado', 'webhook_removido')), 2,
  'trilha de editar e remover');
select throws_ok(format('select public.rs_fn_remove_webhook(%L, %L, %L)', gen_random_uuid(), pg_temp.id('w_cand'), pg_temp.ator('m')),
  'P0001', 'papel_insuficiente', 'outra empresa não remove');

-- Vencidas pelo relógio do banco
insert into fx select 'w_v', pg_temp.salva('https://hooks.exemplo.dev/v', array['vaga.encerrada']);
select public.rs_fn_registra_evento(pg_temp.id('e'), pg_temp.id('v'), null, 'vaga_encerrada', pg_temp.ator('m'), 'web', '{}');
select is((select count(*)::int from public.rs_fn_entregas_vencidas(pg_temp.id('e'), 50) x
            join public.rs_entregas_webhook w on w.id = x where w.webhook_id = pg_temp.id('w_v')), 1, 'pendente nova já vence');
select is((select count(*)::int from public.rs_fn_entregas_vencidas(gen_random_uuid(), 50)), 0, 'filtra pela empresa');

-- GET /eventos no alcance (11.32)
insert into fx select 'fin', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Financeiro', null, pg_temp.ator('m'));
create function pg_temp.lista(p_alcance jsonb, p_admin boolean) returns text[] language sql as $$
  select coalesce(array_agg(distinct coalesce(vaga_id::text, 'sem_vaga')), '{}') from public.rs_fn_lista_eventos(pg_temp.id('e'), p_alcance, p_admin, 0, 1000) $$;
select is(pg_temp.lista(pg_temp.todas(), true) @> array[pg_temp.id('v')::text, 'sem_vaga'], true, 'administrador vê eventos de vaga e sem vaga');
select is(pg_temp.lista(jsonb_build_object('tipo', 'areas', 'area_ids', jsonb_build_array(pg_temp.id('fin'))), false), '{}'::text[],
  'recrutador de outra área não vê a vaga nem os eventos sem vaga');
select is(pg_temp.lista(jsonb_build_object('tipo', 'areas', 'area_ids', jsonb_build_array(pg_temp.id('area'))), false), array[pg_temp.id('v')::text],
  'recrutador da área vê só a vaga dele');
select is((select min(id) > (select min(id) from public.rs_eventos where empresa_id = pg_temp.id('e'))
             from public.rs_fn_lista_eventos(pg_temp.id('e'), pg_temp.todas(), true, (select min(id) from public.rs_eventos where empresa_id = pg_temp.id('e')), 10)),
  true, 'desde exclui o próprio id');

-- Achado A1 do verifier: webhook desligado, empresa suspensa e entrega no máximo de tentativas não
-- entram nas vencidas (senão travam a fila das outras).
update public.rs_webhooks set ativo = false where id = pg_temp.id('w_v');
select is((select count(*)::int from public.rs_fn_entregas_vencidas(pg_temp.id('e'), 50, 8) x
            join public.rs_entregas_webhook w on w.id = x where w.webhook_id = pg_temp.id('w_v')), 0, 'webhook desligado fora das vencidas');
update public.rs_webhooks set ativo = true where id = pg_temp.id('w_v');
update public.rs_empresas set suspensa_em = now() where id = pg_temp.id('e');
select is((select count(*)::int from public.rs_fn_entregas_vencidas(pg_temp.id('e'), 50, 8)), 0, 'empresa suspensa fora das vencidas');
update public.rs_empresas set suspensa_em = null where id = pg_temp.id('e');
update public.rs_entregas_webhook set tentativas = 8 where webhook_id = pg_temp.id('w_v');
select is((select count(*)::int from public.rs_fn_entregas_vencidas(pg_temp.id('e'), 50, 8) x
            join public.rs_entregas_webhook w on w.id = x where w.webhook_id = pg_temp.id('w_v')), 0, 'no máximo de tentativas fora das vencidas');
update public.rs_entregas_webhook set reservada_em = now() - interval '5 minutes' where webhook_id = pg_temp.id('w_v');
select is(public.rs_fn_desiste_entregas(interval '3 days', 8) >= 1, true, 'a que morreu no meio com 8 tentativas desiste');

select * from finish();
rollback;
