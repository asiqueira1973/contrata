-- Limite de empresas por conta na instância aberta (v0.4.19; decisão de 23/11/2026). Quem entra pelo
-- "*" de CRIACAO_EMPRESA_EMAILS cria até p_max_criadas empresas (a excluída não conta); quem está
-- nominalmente na lista chama sem limite (p_max_criadas nulo). Um lock por usuário na transação
-- impede que dois pedidos ao mesmo tempo passem juntos.
drop function if exists public.rs_fn_cria_empresa(uuid, text, text, text);

-- Cria a empresa com o usuário como administrador e a pessoa dele (6.1, 11.33). Recebe: usuário,
-- slug, nome, e-mail de contato e o limite (nulo = sem limite). Devolve o id. Erros (P0001):
-- usuario_invalido, slug_em_uso, limite_empresas.
create function public.rs_fn_cria_empresa(p_usuario uuid, p_slug text, p_nome text, p_email_contato text, p_max_criadas integer default null)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_u public.rs_usuarios;
  v_empresa uuid;
  v_membro uuid;
begin
  select * into v_u from public.rs_usuarios where id = p_usuario and suspenso_em is null;
  if v_u.id is null then
    raise exception 'usuario_invalido' using errcode = 'P0001';
  end if;
  if p_max_criadas is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rs_cria_empresa:' || p_usuario::text, 0));
    if (select count(*) from public.rs_empresas where criada_por_usuario_id = p_usuario and excluida_em is null) >= p_max_criadas then
      raise exception 'limite_empresas' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from public.rs_empresas where slug = p_slug) then
    raise exception 'slug_em_uso' using errcode = 'P0001';
  end if;
  insert into public.rs_empresas (slug, nome, email_contato, criada_por_usuario_id)
  values (p_slug, p_nome, p_email_contato, p_usuario) returning id into v_empresa;
  insert into public.rs_membros (empresa_id, usuario_id, email, papel, aceito_em)
  values (v_empresa, p_usuario, v_u.email, 'administrador', pg_catalog.now()) returning id into v_membro;
  insert into public.rs_pessoas (empresa_id, nome, email, membro_id) values (v_empresa, v_u.nome, v_u.email, v_membro);
  perform public.rs_fn_registra_evento(v_empresa, null, null, 'empresa_criada',
    pg_catalog.jsonb_build_object('tipo', 'membro', 'membro_id', v_membro), 'web', '{}');
  return v_empresa;
end $$;

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
