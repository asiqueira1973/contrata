-- Alertas da instância (spec 6.1, 18, 23.1) e aviso de empresa sem espaço (11.14), v0.4.13.
-- 1) rs_notificacoes.empresa_id anulável: o alerta da instância vai ao ADMIN_EMAIL e não é de
--    nenhuma empresa. 2) tipos novos de notificação. 3) a retentativa da faxina passa a incluir as
--    sem empresa (left join: sem empresa, não há suspensão nem exclusão a conferir).
-- 4) rs_fn_tamanho_banco para o alerta de 70% do plano (23.1).

alter table public.rs_notificacoes alter column empresa_id drop not null;

alter type public.rs_tipo_notificacao add value if not exists 'alerta_instancia';
alter type public.rs_tipo_notificacao add value if not exists 'armazenamento_cheio';

-- Notificações a retentar: as que falharam com tentativas sobrando e as pendentes que o envio logo
-- depois da resposta perdeu (mais de 10 min), de empresa ativa ou sem empresa (alerta da
-- instância). Recebe: lote e máximo. Devolve os ids.
create or replace function public.rs_fn_notificacoes_a_retentar(p_lote integer, p_max integer) returns setof uuid
language sql stable set search_path = '' as $$
  select n.id from public.rs_notificacoes n left join public.rs_empresas e on e.id = n.empresa_id
   where (n.empresa_id is null or (e.excluida_em is null and e.suspensa_em is null))
     and n.tentativas < p_max and n.enviar_apos <= pg_catalog.now()
     and (n.status = 'falhou' or (n.status = 'pendente' and n.criado_em < pg_catalog.now() - interval '10 minutes'))
   order by n.criado_em limit greatest(p_lote, 0) $$;

-- Tamanho do banco inteiro em bytes (23.1): é o que o plano do Supabase limita, inclusive no
-- projeto compartilhado. Recebe nada; devolve bytes.
create or replace function public.rs_fn_tamanho_banco() returns bigint
language sql stable set search_path = '' as $$
  select pg_catalog.pg_database_size(pg_catalog.current_database()) $$;

-- ---------------------------------------------------------------- privilégios (6.5)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'rs\_fn\_%' or p.proname like 'rs\_tg\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
