-- Alertas da instância (v0.4.13; 6.1, 18, 23.1): notificação sem empresa é aceita e entra na
-- retentativa da faxina; rs_fn_tamanho_banco devolve bytes e não é exposta a anon/authenticated.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.rs_notificacoes (tipo, destinatario, chave_idempotencia, assunto, html, texto, status, criado_em)
values ('alerta_instancia', 'admin@alertas.teste.dev', 'alerta:pgtap:' || gen_random_uuid(), 'a', 'h', 't', 'falhou', now() - interval '1 hour');

select ok((select count(*) from public.rs_notificacoes where destinatario = 'admin@alertas.teste.dev' and empresa_id is null) = 1,
  'alerta da instância é gravado sem empresa');
select ok((select n.id from public.rs_notificacoes n where destinatario = 'admin@alertas.teste.dev')
  in (select public.rs_fn_notificacoes_a_retentar(10000, 5)), 'a faxina retenta o alerta que falhou (sem empresa)');
select ok(public.rs_fn_tamanho_banco() > 0, 'rs_fn_tamanho_banco devolve o tamanho do banco em bytes');
select ok(not has_function_privilege('anon', 'public.rs_fn_tamanho_banco()', 'execute'), 'anon não executa rs_fn_tamanho_banco');
select ok(not has_function_privilege('authenticated', 'public.rs_fn_tamanho_banco()', 'execute'), 'authenticated não executa rs_fn_tamanho_banco');
select ok(has_function_privilege('service_role', 'public.rs_fn_tamanho_banco()', 'execute'), 'service_role executa rs_fn_tamanho_banco');

select * from finish();
rollback;
