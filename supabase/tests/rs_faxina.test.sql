-- Faxina diária (épico 8.10): convite vencido sai; expurgo anonimiza na data e não antes; com
-- talentos válido guarda nome, contato e o currículo mais recente até vencer, depois anonimiza
-- tudo; arquivos devolvidos; notificações a retentar e limpeza; resumo diário com responsável e
-- equipe; resumo semanal só para dono sem acesso; pedir acesso registra.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p), 'origem', 'formulario') $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.cand(p_k text, p_talentos boolean, p_cv boolean) returns uuid language plpgsql as $$
declare c uuid;
begin
  c := (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v'), jsonb_build_object('nome', 'Pessoa ' || p_k, 'email', p_k || '@fx.teste.dev'),
    '[]', 'pagina', pg_temp.publico(), '2026-11-20', p_talentos, 'tok-' || p_k || '-' || gen_random_uuid(), 10000) ->> 'id')::uuid;
  perform public.rs_fn_conclui_candidatura(c, pg_temp.id('e'),
    case when p_cv then jsonb_build_object('path', pg_temp.id('e') || '/' || c || '/curriculo.pdf', 'nome_original', 'cv.pdf', 'mime', 'application/pdf', 'bytes', 100, 'sha256', 'x') end,
    '{"assunto":"a","corpo":"b"}',
    jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', 'rec:' || c, 'assunto', 'a', 'html', 'h', 'texto', 't'),
    pg_temp.publico(), 'fin-' || c);
  return c;
end $$;
create function pg_temp.encerra(p_c uuid) returns void language plpgsql as $$
begin
  perform public.rs_fn_encerra_candidatura(p_c, pg_temp.id('e'), 'desistiu', pg_temp.publico(), null,
    jsonb_build_object('tipo', 'desistencia', 'assunto', 'a', 'corpo', 'b', 'notificacao', jsonb_build_object('tipo', 'mensagem_candidato',
      'destinatario', 'x@teste.dev', 'chave', 'des:' || p_c, 'assunto', 'a', 'html', 'h', 'texto', 't')), '{}');
  update public.rs_candidaturas set expurgar_em = now() - interval '1 minute' where id = p_c;
end $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-fx-ana', 'ana-fx@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'fx-padaria', 'Padaria', 'ana-fx@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e');
insert into fx select 'dono', public.rs_fn_salva_pessoa(pg_temp.id('e'), null, 'Dora Dona', 'dora@fx.teste.dev', null, null, true, pg_temp.ator('m'));
insert into fx select 'v', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Vaga X', 'modelo_trabalho', 'remoto',
  'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4), 'dono_pessoa_id', pg_temp.id('dono'),
  'etapas', '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista","tipo":"entrevista"}]'::jsonb), pg_temp.todas(), pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v'), pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m'), 50);

-- Convites
insert into public.rs_membros (empresa_id, email, papel, convite_token_hash, convite_expira_em) values
  (pg_temp.id('e'), 'velho@fx.teste.dev', 'avaliador', 'h1', now() - interval '1 hour'),
  (pg_temp.id('e'), 'novo@fx.teste.dev', 'avaliador', 'h2', now() + interval '1 day');
select is(public.rs_fn_faxina_convites(200) >= 1, true, 'convite vencido sai');
select isnt((select removido_em from public.rs_membros where email = 'velho@fx.teste.dev'), null, 'o vencido foi removido');
select is((select removido_em from public.rs_membros where email = 'novo@fx.teste.dev'), null, 'o válido fica');
select is((select dados ->> 'motivo' from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'convite_cancelado'), 'venceu', 'evento com o motivo');

-- Expurgo (11.12)
insert into fx select 'a', pg_temp.cand('a', false, true);
insert into fx select 'b', pg_temp.cand('b', true, true);
insert into fx select 'z', pg_temp.cand('z', false, false);
select pg_temp.encerra(pg_temp.id('a'));
select pg_temp.encerra(pg_temp.id('b'));
select pg_temp.encerra(pg_temp.id('z'));
update public.rs_candidaturas set expurgar_em = now() + interval '1 day' where id = pg_temp.id('z');
create temp table r1 as select public.rs_fn_faxina_expurgos(200) as r;
select is((select token_hash like 'anonimizada:%' from public.rs_candidaturas where id = pg_temp.id('a')), true, 'vencida anonimizada');
select is((select token_hash like 'anonimizada:%' from public.rs_candidaturas where id = pg_temp.id('z')), false, 'antes da data não');
select is((select r -> 'paths' ? (pg_temp.id('e') || '/' || pg_temp.id('a') || '/curriculo.pdf') from r1), true, 'arquivo da anonimizada devolvido');
select is((select nome from public.rs_candidatos c join public.rs_candidaturas x on x.candidato_id = c.id where x.id = pg_temp.id('a')),
  'Pessoa removida', 'pessoa sem talentos anonimizada');
select is((select nome from public.rs_candidatos c join public.rs_candidaturas x on x.candidato_id = c.id where x.id = pg_temp.id('b')),
  'Pessoa b', 'com talentos válido: nome fica');
select is((select count(*)::int from public.rs_arquivos where candidatura_id = pg_temp.id('b') and tipo = 'curriculo'), 1, 'e o currículo mais recente fica');
select is((select expurgada_em is not null from public.rs_candidaturas where id = pg_temp.id('b')), true, 'a candidatura dela é expurgada (o link fica: achado A1)');
update public.rs_candidatos set talentos_expira_em = now() - interval '1 minute'
  where id = (select candidato_id from public.rs_candidaturas where id = pg_temp.id('b'));
create temp table r2 as select public.rs_fn_faxina_expurgos(200) as r;
select is((select r -> 'paths' ? (pg_temp.id('e') || '/' || pg_temp.id('b') || '/curriculo.pdf') from r2), true, 'talentos vencido: o currículo guardado sai');
select is((select nome from public.rs_candidatos c join public.rs_candidaturas x on x.candidato_id = c.id where x.id = pg_temp.id('b')),
  'Pessoa removida', 'e a pessoa é anonimizada');
select is((select (r ->> 'candidaturas')::int from (select public.rs_fn_faxina_expurgos(200) as r) s), 0, 'rodar de novo não faz nada');

-- Achados do verifier (8.10)
-- A1: quem fica no banco de talentos depois do expurgo mantém o link /c (aviso, renovar, excluir).
insert into fx select 't1', pg_temp.cand('t1', true, true);
select pg_temp.encerra(pg_temp.id('t1'));
select public.rs_fn_faxina_expurgos(200);
select is((select token_hash like 'anonimizada:%' from public.rs_candidaturas where id = pg_temp.id('t1')), false, 'a candidatura que guarda o currículo mantém o link');
select is((select count(*)::int from public.rs_respostas where candidatura_id = pg_temp.id('t1')), 0, 'e o resto é anonimizado');
select is((select (r ->> 'candidaturas')::int from (select public.rs_fn_faxina_expurgos(200) r) s), 0, 'e não volta a ser expurgada');
update public.rs_candidatos set talentos_expira_em = now() + interval '10 days', talentos_avisado_em = null
  where id = (select candidato_id from public.rs_candidaturas where id = pg_temp.id('t1'));
select is((select count(*)::int from jsonb_array_elements(public.rs_fn_faxina_talentos(200) -> 'avisar') a where a ->> 'candidatura_id' = pg_temp.id('t1')::text), 1,
  'o aviso de 30 dias sai com o link dessa candidatura');
-- B1: com duas candidaturas expurgadas, só o currículo mais recente fica.
insert into fx select 'v2', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Vaga Y', 'modelo_trabalho', 'remoto',
  'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4),
  'etapas', '[{"nome":"Triagem","tipo":"triagem"}]'::jsonb), pg_temp.todas(), pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v2'), pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m'), 50);
update fx set id = pg_temp.id('v2') where k = 'v';
insert into fx select 't2', pg_temp.cand('t1', false, true);
select pg_temp.encerra(pg_temp.id('t2'));
update fx set id = (select id from public.rs_vagas where titulo = 'Vaga X' and empresa_id = pg_temp.id('e')) where k = 'v';
select public.rs_fn_faxina_expurgos(200);
select is((select count(*)::int from public.rs_arquivos a join public.rs_candidaturas x on x.id = a.candidatura_id
            where x.candidato_id = (select candidato_id from public.rs_candidaturas where id = pg_temp.id('t1')) and a.tipo = 'curriculo'), 1,
  'só um currículo guardado');

-- Empresas a expurgar
select is((select count(*)::int from public.rs_fn_empresas_a_expurgar(10) x where x = pg_temp.id('e')), 0, 'empresa ativa não');

-- Notificações
insert into public.rs_notificacoes (empresa_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, status, tentativas, criado_em) values
  (pg_temp.id('e'), 'resumo_diario', 'x@teste.dev', 'n1', 'a', 'h', 't', 'falhou', 2, now()),
  (pg_temp.id('e'), 'resumo_diario', 'x@teste.dev', 'n2', 'a', 'h', 't', 'falhou', 5, now()),
  (pg_temp.id('e'), 'resumo_diario', 'x@teste.dev', 'n3', 'a', 'h', 't', 'pendente', 0, now() - interval '20 minutes'),
  (pg_temp.id('e'), 'resumo_diario', 'x@teste.dev', 'n4', 'a', 'h', 't', 'pendente', 0, now()),
  (pg_temp.id('e'), 'resumo_diario', 'x@teste.dev', 'n5', 'a', '', '', 'enviada', 1, now() - interval '31 days'),
  (pg_temp.id('e'), 'resumo_diario', 'x@teste.dev', 'n6', 'a', '', '', 'enviada', 1, now() - interval '29 days');
select is((select array_agg(chave_idempotencia order by chave_idempotencia) from public.rs_notificacoes
            where id in (select public.rs_fn_notificacoes_a_retentar(200, 5)) and chave_idempotencia like 'n_'), array['n1', 'n3'],
  'retenta a que falhou com tentativas e a pendente perdida');
select is(public.rs_fn_limpa_notificacoes(30, 200) >= 1, true, 'limpa as velhas');
select is((select count(*)::int from public.rs_notificacoes where chave_idempotencia in ('n5', 'n6')), 1, 'só a de mais de 30 dias');

-- Resumo diário
insert into fx select 'p', pg_temp.cand('p', false, false);
update public.rs_candidaturas set movida_em = now() - interval '15 days' where id = pg_temp.id('p');
select is((select (r -> 'vagas' -> 0 ->> 'paradas')::int from (select public.rs_fn_resumo_diario(pg_temp.id('e'), 14, 15) r) s), 1, 'parada há 14+ dias conta');
select is((select r -> 'vagas' -> 0 ->> 'responsavel' from (select public.rs_fn_resumo_diario(pg_temp.id('e'), 14, 15) r) s), null, 'sem responsável');
insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga) values (pg_temp.id('v'), pg_temp.id('m'), 'responsavel');
select is((select (r -> 'vagas' -> 0 ->> 'responsavel')::uuid from (select public.rs_fn_resumo_diario(pg_temp.id('e'), 14, 15) r) s), pg_temp.id('m'), 'com responsável');
select is((select jsonb_array_length(r -> 'membros') from (select public.rs_fn_resumo_diario(pg_temp.id('e'), 14, 15) r) s), 1, 'a equipe que pode receber');
select is((select r::text like '%Pessoa p%' from (select public.rs_fn_resumo_diario(pg_temp.id('e'), 14, 15) r) s), false, 'sem nome de candidato');

-- Resumo semanal (11.31)
select is((select count(*)::int from jsonb_array_elements(public.rs_fn_resumo_donos(200)) x where x ->> 'vaga_id' = pg_temp.id('v')::text), 1,
  'dono sem acesso recebe');
select is((select (x ->> 'em_analise')::int from jsonb_array_elements(public.rs_fn_resumo_donos(200)) x where x ->> 'vaga_id' = pg_temp.id('v')::text), 1,
  'com a contagem em análise');
update public.rs_pessoas set recebe_resumo = false where id = pg_temp.id('dono');
select is((select count(*)::int from jsonb_array_elements(public.rs_fn_resumo_donos(200)) x where x ->> 'vaga_id' = pg_temp.id('v')::text), 0,
  'sem recebe_resumo, não');

-- Pedir acesso
select is((select public.rs_fn_pede_acesso(pg_temp.id('e'), pg_temp.id('dono')) ->> 'nome'), 'Dora Dona', 'pede acesso');
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'acesso_pedido'), 1, 'evento acesso_pedido');
select public.rs_fn_pede_acesso(pg_temp.id('e'), pg_temp.id('dono'));
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'acesso_pedido'), 1, 'pedir de novo no mesmo dia não repete o evento (B2)');
select throws_ok(format('select public.rs_fn_pede_acesso(%L, %L)', gen_random_uuid(), pg_temp.id('dono')), 'P0001', 'nao_encontrado', 'outra empresa não');

-- Expurgo da empresa com nota de integração, avaliação e mensagem ligada à notificação (achado do 8.10)
insert into fx select 'k', public.rs_fn_cria_chave_api(pg_temp.id('e'), 'n8n', 'rsk_abcd', 'hash-k-' || gen_random_uuid(), '{leitura,escrita}', 10, pg_temp.ator('m'));
insert into public.rs_notas (candidatura_id, texto, ator_tipo, credencial_id) values (pg_temp.id('p'), 'nota', 'api', pg_temp.id('k'));
select lives_ok(format('select public.rs_fn_limpa_notificacoes(%s, %s)', 0, 1000), 'limpar notificação ligada a mensagem não quebra');
update public.rs_empresas set excluida_em = now() - interval '8 days' where id = pg_temp.id('e');
select is((select count(*)::int from public.rs_fn_empresas_a_expurgar(1000) x where x = pg_temp.id('e')), 1, 'excluída há 8 dias entra');
select lives_ok(format('select public.rs_fn_expurga_empresa(%L)', pg_temp.id('e')), 'expurga com nota de integração e mensagens');
select is((select count(*)::int from public.rs_empresas where id = pg_temp.id('e')), 0, 'empresa apagada');

select * from finish();
rollback;
