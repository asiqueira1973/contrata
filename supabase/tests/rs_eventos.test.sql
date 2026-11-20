-- Regra 11.6: rs_eventos só recebe inserção por rs_fn_registra_evento; nunca muda nem se apaga,
-- exceto no expurgo da empresa excluída (7.4), liberado só para aquela empresa.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx as
select (public.rs_fn_entra_usuario('sub-evt-ana', 'ana-evt@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid as ana;
alter table fx add column empresa uuid, add column outra uuid;
update fx set empresa = public.rs_fn_cria_empresa(ana, 'evt-padaria', 'Padaria', 'ana-evt@teste.dev'),
              outra = public.rs_fn_cria_empresa(ana, 'evt-outra', 'Outra', 'ana-evt@teste.dev');

select is((select count(*)::int from public.rs_eventos where empresa_id = (select empresa from fx) and tipo = 'empresa_criada'),
          1, 'criar empresa grava empresa_criada na mesma transação');
select is((select ator_tipo::text from public.rs_eventos where empresa_id = (select empresa from fx)), 'membro',
          'evento com ator membro');

select throws_ok(format('update public.rs_eventos set dados = %L where empresa_id = %L', '{"x":1}', (select empresa from fx)),
                 'P0001', 'trilha_imutavel', 'update recusado');
select throws_ok(format('delete from public.rs_eventos where empresa_id = %L', (select empresa from fx)),
                 'P0001', 'trilha_imutavel', 'delete recusado');
select throws_ok(format($q$select public.rs_fn_registra_evento(%L, null, null, 'inventado', '{"tipo":"sistema"}', 'cron', '{}')$q$,
                 (select empresa from fx)), '23514', null, 'tipo fora do catálogo recusado');
select throws_ok(format($q$select public.rs_fn_registra_evento(%L, null, null, 'empresa_criada', null, 'cron', '{}')$q$,
                 (select empresa from fx)), 'P0001', 'ator_obrigatorio', 'ator obrigatório');

-- Liberação do expurgo vale só para a empresa da variável.
select set_config('rs.expurgo_empresa', (select outra::text from fx), true);
select throws_ok(format('delete from public.rs_empresas where id = %L', (select empresa from fx)),
                 'P0001', 'trilha_imutavel', 'expurgo de outra empresa não libera');
select set_config('rs.expurgo_empresa', (select empresa::text from fx), true);
select lives_ok(format('delete from public.rs_empresas where id = %L', (select empresa from fx)), 'expurgo da empresa apaga em cascata');
select is((select count(*)::int from public.rs_eventos where empresa_id = (select empresa from fx)), 0, 'trilha da empresa expurgada some');
select is((select count(*)::int from public.rs_eventos where empresa_id = (select outra from fx)), 1, 'trilha da outra empresa fica');

select throws_ok(format('select public.rs_fn_expurga_empresa(%L)', (select outra from fx)), 'P0001', 'empresa_nao_expurgavel',
                 'empresa não excluída não se expurga');
update public.rs_empresas set excluida_em = now() - interval '6 days' where id = (select outra from fx);
select throws_ok(format('select public.rs_fn_expurga_empresa(%L)', (select outra from fx)), 'P0001', 'empresa_nao_expurgavel',
                 'excluída há menos de 7 dias não se expurga');
update public.rs_empresas set excluida_em = now() - interval '8 days' where id = (select outra from fx);
select lives_ok(format('select public.rs_fn_expurga_empresa(%L)', (select outra from fx)), 'expurgo depois de 7 dias');
select is((select count(*)::int from public.rs_empresas where id = (select outra from fx)), 0, 'empresa expurgada');
select is(current_setting('rs.expurgo_empresa', true), '', 'liberação da trilha não sobra na transação');

select * from finish();
rollback;
