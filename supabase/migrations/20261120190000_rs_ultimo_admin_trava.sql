-- Regra 11.26 sob concorrência (achado do verifier no 8.1): dois administradores que se rebaixam
-- ou se removem ao mesmo tempo podiam deixar a empresa sem nenhum, porque cada transação via o
-- outro ainda ativo. Agora a função trava (for update) os administradores ativos da empresa antes
-- de contar: a segunda transação espera a primeira e conta de novo.
create or replace function public.rs_fn_garante_administrador(p_membro uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_m public.rs_membros;
  v_outros integer;
begin
  select * into v_m from public.rs_membros where id = p_membro;
  if v_m.papel <> 'administrador' or v_m.aceito_em is null or v_m.removido_em is not null then
    return;
  end if;
  perform 1 from public.rs_membros
   where empresa_id = v_m.empresa_id and papel = 'administrador' and aceito_em is not null and removido_em is null
   order by id
   for update;
  select count(*) into v_outros from public.rs_membros
   where empresa_id = v_m.empresa_id and id <> p_membro
     and papel = 'administrador' and aceito_em is not null and removido_em is null;
  if v_outros = 0 then
    raise exception 'ultimo_administrador' using errcode = 'P0001';
  end if;
end $$;

revoke execute on function public.rs_fn_garante_administrador(uuid) from public, anon, authenticated;
grant execute on function public.rs_fn_garante_administrador(uuid) to service_role;
