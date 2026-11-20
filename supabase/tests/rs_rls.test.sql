-- 6.5 e 20.3: toda rs_* com RLS ligada, nenhuma política, nenhum privilégio para anon e
-- authenticated, e nenhuma função rs_ executável por eles. Asserções geradas do catálogo:
-- tabela ou função nova entra sozinha no teste.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(c.relrowsecurity, 'RLS ligada em ' || c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'rs\_%';

select is((select count(*)::int from pg_policies where tablename like 'rs\_%'), 0, 'nenhuma política em rs_*');

select ok(not has_table_privilege(r, c.oid, p), r || ' sem ' || p || ' em ' || c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace,
       unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'rs\_%';

select ok(not has_function_privilege(r, p.oid, 'execute'), r || ' sem execute em ' || p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace, unnest(array['anon', 'authenticated']) r
 where n.nspname = 'public' and p.proname like 'rs\_%';

select ok(not p.prosecdef, p.proname || ' é SECURITY INVOKER')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'rs\_%';

select ok(p.proconfig @> array['search_path=""'], p.proname || ' com search_path vazio')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'rs\_%';

set local role anon;
select throws_ok('select * from public.rs_usuarios', '42501', null, 'anon não lê rs_usuarios');
reset role;
set local role authenticated;
select throws_ok('select * from public.rs_candidaturas', '42501', null, 'authenticated não lê rs_candidaturas');
reset role;

select * from finish();
rollback;
