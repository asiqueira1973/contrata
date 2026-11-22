-- Banco de talentos (épico 8.7): busca só entre consentidos válidos e no alcance (11.32), convite
-- sem consentimento recusado e sem criar candidatura, quem já é candidato pulado, convite usado vira
-- origem banco_talentos (e de outra vaga não vale), entrar, renovar e sair pelo /c, e a faxina (aviso
-- de 30 dias uma vez, vencido sai do banco).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p), 'origem', 'formulario') $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.vaga(p_k text, p_area text) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Vaga ' || p_k, 'area_id', pg_temp.id(p_area), 'modelo_trabalho', 'remoto',
    'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4), 'etapas', '[{"nome":"Triagem","tipo":"triagem"}]'::jsonb),
    pg_temp.todas(), pg_temp.ator('m')) ->> 'id')::uuid;
  perform public.rs_fn_transicao_vaga(v, pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m'), 50);
  insert into fx values (p_k, v);
  return v;
end $$;
-- Candidata e conclui; p_talentos marca a caixa do banco de talentos. Devolve a candidatura.
create function pg_temp.cand(p_k text, p_vaga text, p_talentos boolean, p_convite uuid default null) returns uuid language plpgsql as $$
declare c uuid;
begin
  c := (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id(p_vaga), jsonb_build_object('nome', 'Pessoa ' || p_k, 'email', p_k || '@ta.teste.dev'),
    '[]', 'pagina', pg_temp.publico(), '2026-11-20', p_talentos, 'tok-' || p_k || '-' || gen_random_uuid(), 10000, p_convite) ->> 'id')::uuid;
  perform public.rs_fn_conclui_candidatura(c, pg_temp.id('e'), null, '{"assunto":"a","corpo":"b"}',
    jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', 'rec:' || c, 'assunto', 'a', 'html', 'h', 'texto', 't'),
    pg_temp.publico(), 'fin-' || c);
  return c;
end $$;
create function pg_temp.busca(p_alcance jsonb, p_filtros jsonb) returns text language sql as $$
  select coalesce(string_agg(nome, ',' order by nome), '') from public.rs_fn_busca_talentos(pg_temp.id('e'), p_alcance, p_filtros, 0, 50) $$;
create function pg_temp.candidato(p_k text) returns uuid language sql as $$
  select id from public.rs_candidatos where email operator(extensions.=) (p_k || '@ta.teste.dev')::extensions.citext $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-ta-ana', 'ana-ta@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'ta-padaria', 'Padaria', 'ana-ta@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e');
insert into fx select 'loja', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Loja', null, pg_temp.ator('m'));
insert into fx select 'fin', public.rs_fn_salva_area(pg_temp.id('e'), null, 'Financeiro', null, pg_temp.ator('m'));
create function pg_temp.loja() returns jsonb language sql as $$ select jsonb_build_object('tipo', 'areas', 'area_ids', jsonb_build_array(pg_temp.id('loja'))) $$;

select pg_temp.vaga('v1', 'loja');
select pg_temp.vaga('v2', 'fin');
select pg_temp.vaga('v3', 'loja');
insert into fx select 'c_bia', pg_temp.cand('bia', 'v1', true);
insert into fx select 'c_caio', pg_temp.cand('caio', 'v2', true);
insert into fx select 'c_davi', pg_temp.cand('davi', 'v1', false);
insert into fx select 'c_eva', pg_temp.cand('eva', 'v1', true);
update public.rs_candidatos set talentos_expira_em = now() - interval '1 day' where id = pg_temp.candidato('eva');

-- Buscar (8.7, 11.32)
select is(pg_temp.busca(pg_temp.todas(), '{}'), 'Pessoa bia,Pessoa caio', 'só consentimento válido (sem consentimento e vencido ficam fora)');
select is(pg_temp.busca(pg_temp.loja(), '{}'), 'Pessoa bia', 'recrutador limitado só vê quem se candidatou a vaga do alcance');
select is(pg_temp.busca('{"tipo":"equipe","membro_id":"00000000-0000-0000-0000-000000000000"}', '{}'), '', 'avaliador não usa o banco de talentos');
select is(pg_temp.busca(pg_temp.todas(), jsonb_build_object('vaga_anterior', pg_temp.id('v2'))), 'Pessoa caio', 'filtro por vaga anterior');
select is(pg_temp.busca(pg_temp.todas(), '{"q":"caio"}'), 'Pessoa caio', 'busca por texto');

-- Convidar (8.7)
select throws_ok(format('select public.rs_fn_convida_talento(%L, %L, %L, %L, %L)', pg_temp.id('e'), pg_temp.candidato('davi'), pg_temp.id('v3'),
  pg_temp.todas(), pg_temp.ator('m')), 'P0001', 'talento_indisponivel', 'sem consentimento não é convidado');
select throws_ok(format('select public.rs_fn_convida_talento(%L, %L, %L, %L, %L)', pg_temp.id('e'), pg_temp.candidato('caio'), pg_temp.id('v3'),
  pg_temp.loja(), pg_temp.ator('m')), 'P0001', 'talento_indisponivel', 'fora do alcance não é convidado');
select is((public.rs_fn_convida_talento(pg_temp.id('e'), pg_temp.candidato('bia'), pg_temp.id('v1'), pg_temp.todas(), pg_temp.ator('m')) ->> 'ja_candidato')::boolean,
  true, 'quem já se candidatou à vaga é pulado');
insert into fx select 'conv', (public.rs_fn_convida_talento(pg_temp.id('e'), pg_temp.candidato('bia'), pg_temp.id('v3'), pg_temp.todas(), pg_temp.ator('m')) ->> 'convite_id')::uuid;
select is((public.rs_fn_convida_talento(pg_temp.id('e'), pg_temp.candidato('bia'), pg_temp.id('v3'), pg_temp.todas(), pg_temp.ator('m')) ->> 'convite_id')::uuid,
  pg_temp.id('conv'), 'convidar de novo reaproveita o convite');
select is((select count(*)::int from public.rs_candidaturas where vaga_id = pg_temp.id('v3')), 0, 'convite não cria candidatura');
select is((select dados ->> 'convite_id' from public.rs_eventos where tipo = 'talentos_convidado' and empresa_id = pg_temp.id('e') order by id limit 1),
  pg_temp.id('conv')::text, 'evento talentos_convidado só com ids');

-- Candidatar com o convite (origem banco_talentos)
insert into fx select 'c_outra', pg_temp.cand('caio', 'v1', false, pg_temp.id('conv'));
select is((select origem::text from public.rs_candidaturas where id = pg_temp.id('c_outra')), 'pagina', 'convite de outra pessoa não vale');
insert into fx select 'c_conv', pg_temp.cand('bia', 'v3', false, pg_temp.id('conv'));
select is((select origem::text from public.rs_candidaturas where id = pg_temp.id('c_conv')), 'banco_talentos', 'convite válido: origem banco_talentos');
select isnt((select usado_em from public.rs_convites_talento where id = pg_temp.id('conv')), null, 'o convite fica usado');

-- O titular no /c
select is(public.rs_fn_talentos_candidato(pg_temp.id('c_davi'), 'entrar') > now() + interval '11 months', true, 'entrar vale por talentos_meses');
select is(pg_temp.busca(pg_temp.todas(), '{}'), 'Pessoa bia,Pessoa caio,Pessoa davi', 'e passa a aparecer na busca');
select is(public.rs_fn_talentos_candidato(pg_temp.id('c_davi'), 'sair'), null, 'sair');
select is((select talentos_consentido_em from public.rs_candidatos where id = pg_temp.candidato('davi')), null, 'sai do banco');
select is((select count(*)::int from public.rs_eventos where candidatura_id = pg_temp.id('c_davi') and tipo in ('talentos_consentido', 'talentos_retirado')), 2,
  'eventos de entrar e sair');

-- Faxina: aviso de 30 dias uma vez, vencido sai
update public.rs_candidatos set talentos_expira_em = now() + interval '10 days' where id = pg_temp.candidato('caio');
select is(jsonb_array_length(public.rs_fn_faxina_talentos(200) -> 'avisar'), 1, 'quem vence em até 30 dias é avisado');
select is(jsonb_array_length(public.rs_fn_faxina_talentos(200) -> 'avisar'), 0, 'uma vez só');
select is((select talentos_consentido_em from public.rs_candidatos where id = pg_temp.candidato('eva')), null, 'vencido sai do banco');
select lives_ok(format('select public.rs_fn_talentos_candidato(%L, %L)', pg_temp.id('c_caio'), 'renovar'), 'renovar');
select is((select talentos_avisado_em from public.rs_candidatos where id = pg_temp.candidato('caio')), null, 'renovar zera o aviso');

-- Achados do verifier (8.7)
-- 1 e 7: o texto só casa candidaturas recebidas no alcance; e-mail não é busca do banco de talentos.
insert into fx select 'c_bia_fin', pg_temp.cand('bia', 'v2', false);
update public.rs_candidaturas set texto_busca = to_tsvector('pg_catalog.portuguese', 'segredofinanceiro') where id = pg_temp.id('c_bia_fin');
select is(pg_temp.busca(pg_temp.loja(), '{"q":"segredofinanceiro"}'), '', 'texto de candidatura fora do alcance não acha a pessoa');
select is(pg_temp.busca(pg_temp.todas(), '{"q":"segredofinanceiro"}'), 'Pessoa bia', 'no alcance, acha');
select is(pg_temp.busca(pg_temp.todas(), '{"q":"bia@ta.teste.dev"}'), '', 'e-mail não é busca do banco de talentos');
-- 2: vaga anterior fora do alcance não filtra nada.
select is(pg_temp.busca(pg_temp.loja(), jsonb_build_object('vaga_anterior', pg_temp.id('v2'))), '', 'vaga anterior fora do alcance não filtra');
-- 6: candidatura não concluída apagada pela faxina devolve o convite.
insert into fx select 'conv3', (public.rs_fn_convida_talento(pg_temp.id('e'), pg_temp.candidato('caio'), pg_temp.id('v3'), pg_temp.todas(), pg_temp.ator('m')) ->> 'convite_id')::uuid;
insert into fx select 'c_meia', (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v3'), '{"nome":"Pessoa caio","email":"caio@ta.teste.dev"}',
  '[]', 'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-meia-' || gen_random_uuid(), 10000, pg_temp.id('conv3')) ->> 'id')::uuid;
delete from public.rs_candidaturas where id = pg_temp.id('c_meia');
insert into fx select 'c_caio3', pg_temp.cand('caio', 'v3', false, pg_temp.id('conv3'));
select is((select origem::text from public.rs_candidaturas where id = pg_temp.id('c_caio3')), 'banco_talentos', 'convite volta a valer se a candidatura não concluída sumiu');
-- 5: empresa suspensa não manda o aviso, e o aviso fica para depois.
update public.rs_candidatos set talentos_expira_em = now() + interval '10 days', talentos_avisado_em = null where id = pg_temp.candidato('caio');
update public.rs_empresas set suspensa_em = now() where id = pg_temp.id('e');
select is((select count(*)::int from jsonb_array_elements(public.rs_fn_faxina_talentos(200) -> 'avisar') a where a ->> 'candidato_id' = pg_temp.candidato('caio')::text),
  0, 'empresa suspensa não avisa');
select is((select talentos_avisado_em from public.rs_candidatos where id = pg_temp.candidato('caio')), null, 'e o aviso fica para depois');

select * from finish();
rollback;
