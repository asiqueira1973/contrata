-- Empresa (épico 8.9): só administrador configura; checks das faixas; retenção nova não mexe em
-- expurgar_em já calculado e vale para a próxima encerrada (24.6); histórico do aviso; logo
-- substitui; exclusão recusada com slug errado e com candidatura em andamento; desfazer dentro de 7
-- dias; trilha.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p), 'origem', 'formulario') $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.salva(p_dados jsonb, p_versao text default null) returns text[] language sql as $$
  select public.rs_fn_salva_empresa(pg_temp.id('e'), p_dados, p_versao, pg_temp.ator('m')) $$;
create function pg_temp.cand(p_k text) returns uuid language plpgsql as $$
declare c uuid;
begin
  c := (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v'), jsonb_build_object('nome', 'Pessoa ' || p_k, 'email', p_k || '@em.teste.dev'),
    '[]', 'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-' || p_k || '-' || gen_random_uuid(), 10000) ->> 'id')::uuid;
  perform public.rs_fn_conclui_candidatura(c, pg_temp.id('e'), null, '{"assunto":"a","corpo":"b"}',
    jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', 'rec:' || c, 'assunto', 'a', 'html', 'h', 'texto', 't'),
    pg_temp.publico(), 'fin-' || c);
  return c;
end $$;
create function pg_temp.desiste(p_c uuid) returns void language plpgsql as $$
begin
  perform public.rs_fn_encerra_candidatura(p_c, pg_temp.id('e'), 'desistiu', pg_temp.publico(), null,
    jsonb_build_object('tipo', 'desistencia', 'assunto', 'a', 'corpo', 'b', 'notificacao', jsonb_build_object('tipo', 'mensagem_candidato',
      'destinatario', 'x@teste.dev', 'chave', 'des:' || p_c, 'assunto', 'a', 'html', 'h', 'texto', 't')), '{}');
end $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-em-ana', 'ana-em@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'em-padaria', 'Padaria', 'ana-em@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e');

-- Salvar
select is(pg_temp.salva('{"descricao":"Pão quente","site_url":"https://padaria.dev","cor_destaque":"#0B5CAD","retencao_dias":120}'),
  array['descricao', 'site_url', 'cor_destaque', 'retencao_dias'], 'grava só o que veio e diz o que mudou');
select is((select cor_destaque from public.rs_empresas where id = pg_temp.id('e')), '#0b5cad', 'cor em minúsculas');
select is(pg_temp.salva('{"descricao":"Pão quente"}'), '{}'::text[], 'nada mudou, nada na trilha');
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'empresa_editada'), 1, 'um evento');
select throws_ok($$ select pg_temp.salva('{"retencao_dias":30}') $$, '23514', null, 'retenção fora de 90–365 recusada');
select throws_ok($$ select pg_temp.salva('{"talentos_meses":30}') $$, '23514', null, 'talentos fora de 6–24 recusado');
select throws_ok($$ select pg_temp.salva('{"site_url":"http://padaria.dev"}') $$, '23514', null, 'site sem https recusado');
select throws_ok(format('select public.rs_fn_salva_empresa(%L, %L, null, %L)', pg_temp.id('e'), '{"nome":"Outra"}',
  jsonb_build_object('tipo', 'membro', 'membro_id', gen_random_uuid())), 'P0001', 'papel_insuficiente', 'quem não é administrador não configura');

-- Aviso de privacidade
select throws_ok($$ select pg_temp.salva('{"aviso_privacidade_extra":"Também usamos para X."}') $$, 'P0001', 'dados_invalidos', 'texto extra exige a versão');
select pg_temp.salva('{"aviso_privacidade_extra":"Também usamos para X."}', '2026-11-20+aaaa1111');
select is((select texto_extra from public.rs_avisos_privacidade where empresa_id = pg_temp.id('e') and versao = '2026-11-20+aaaa1111'),
  'Também usamos para X.', 'histórico guarda o texto da versão');
select pg_temp.salva('{"aviso_privacidade_extra":""}');
select is((select aviso_privacidade_extra from public.rs_empresas where id = pg_temp.id('e')), null, 'vazio limpa');

-- Retenção (24.6)
insert into fx select 'v', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Vaga X', 'modelo_trabalho', 'remoto',
  'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4), 'etapas', '[{"nome":"Triagem","tipo":"triagem"}]'::jsonb),
  pg_temp.todas(), pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v'), pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m'), 50);
insert into fx select 'c1', pg_temp.cand('c1');
select pg_temp.desiste(pg_temp.id('c1'));
select is((select expurgar_em::date - encerrada_em::date from public.rs_candidaturas where id = pg_temp.id('c1')), 120, 'encerrada com 120 dias');
select pg_temp.salva('{"retencao_dias":300}');
select is((select expurgar_em::date - encerrada_em::date from public.rs_candidaturas where id = pg_temp.id('c1')), 120, 'mudar a retenção não mexe na já encerrada');
insert into fx select 'c2', pg_temp.cand('c2');
select pg_temp.desiste(pg_temp.id('c2'));
select is((select expurgar_em::date - encerrada_em::date from public.rs_candidaturas where id = pg_temp.id('c2')), 300, 'a próxima usa a nova');

-- Logo
select is(public.rs_fn_troca_logo(pg_temp.id('e'), pg_temp.id('e') || '/logo.png', 'image/png', 100, 'abc', pg_temp.ator('m')), null, 'primeiro logo');
select is(public.rs_fn_troca_logo(pg_temp.id('e'), pg_temp.id('e') || '/logo.svg', 'image/svg+xml', 50, 'def', pg_temp.ator('m')),
  pg_temp.id('e') || '/logo.png', 'trocar devolve o antigo');
select is((select count(*)::int from public.rs_arquivos where empresa_id = pg_temp.id('e') and tipo = 'logo'), 1, 'uma linha de logo');
select is(public.rs_fn_troca_logo(pg_temp.id('e'), null, null, null, null, pg_temp.ator('m')), pg_temp.id('e') || '/logo.svg', 'remover');
select is((select logo_path from public.rs_empresas where id = pg_temp.id('e')), null, 'sem logo');

-- Excluir e desfazer (7.4)
insert into fx select 'c3', pg_temp.cand('c3');
select throws_ok(format('select public.rs_fn_exclui_empresa(%L, %L, %L)', pg_temp.id('e'), 'outra', pg_temp.ator('m')), 'P0001', 'slug_nao_confere', 'slug errado');
select throws_ok(format('select public.rs_fn_exclui_empresa(%L, %L, %L)', pg_temp.id('e'), 'em-padaria', pg_temp.ator('m')), 'P0001', 'empresa_com_ativas',
  'com candidatura em andamento, recusa');
select pg_temp.desiste(pg_temp.id('c3'));
select lives_ok(format('select public.rs_fn_exclui_empresa(%L, %L, %L)', pg_temp.id('e'), 'em-padaria', pg_temp.ator('m')), 'exclui');
select isnt((select excluida_em from public.rs_empresas where id = pg_temp.id('e')), null, 'marcada');
select throws_ok($$ select pg_temp.salva('{"nome":"Outra"}') $$, 'P0001', 'nao_encontrado', 'excluída não se edita');
update public.rs_empresas set excluida_em = now() - interval '6 days' where id = pg_temp.id('e');
select lives_ok(format('select public.rs_fn_desfaz_exclusao(%L, %L)', pg_temp.id('e'), pg_temp.ator('m')), 'desfaz em 6 dias');
select is((select excluida_em from public.rs_empresas where id = pg_temp.id('e')), null, 'voltou');
update public.rs_empresas set excluida_em = now() - interval '8 days' where id = pg_temp.id('e');
select throws_ok(format('select public.rs_fn_desfaz_exclusao(%L, %L)', pg_temp.id('e'), pg_temp.ator('m')), 'P0001', 'prazo_vencido', 'em 8 dias não');
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo in ('empresa_excluida', 'exclusao_desfeita')), 2, 'trilha');

select * from finish();
rollback;
