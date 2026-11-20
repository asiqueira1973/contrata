-- Contrata — épico 8.2, o conector (spec.md v0.4, seções 6.3, 6.4, 7.2, 11.15 e 11.34).
-- 1) rs_origem_evento: 'painel' vira 'web' (não há mais painel) e entra 'formulario' (clique no
--    salvar_* de um formulário do chat). As funções do 8.1 que gravavam 'painel' são redefinidas
--    com 'web' (corpo tirado do banco por pg_get_functiondef, só com o literal trocado).
-- 2) rs_fn_registra_evento: a origem do ator (p_ator->>'origem'), quando vem, vale no lugar de
--    p_origem. Assim as funções de administração gravam 'formulario' sem mudar de assinatura.
-- 3) OAuth do MCP (6.4), portado do Assina: códigos com empresa, membro e escopos; troca por
--    token MCP (credencial 'mcp'); código reutilizado revoga o token criado com ele.
-- 4) Chaves de API (6.3, 11.15) e revogação de credenciais, com evento na mesma transação.

alter type public.rs_origem_evento rename value 'painel' to 'web';
alter type public.rs_origem_evento add value if not exists 'formulario';

-- Única porta de escrita em rs_eventos (regra 11.6). A origem do ator, quando presente, vence a
-- origem passada pela função (o mesmo domínio serve o formulário, o fallback e a web).
create or replace function public.rs_fn_registra_evento(
  p_empresa uuid, p_vaga uuid, p_candidatura uuid, p_tipo text,
  p_ator jsonb, p_origem public.rs_origem_evento, p_dados jsonb default '{}'
) returns bigint
language plpgsql set search_path = '' as $$
declare v_id bigint;
begin
  if p_ator is null or p_ator ->> 'tipo' is null then
    raise exception 'ator_obrigatorio' using errcode = 'P0001';
  end if;
  insert into public.rs_eventos (empresa_id, vaga_id, candidatura_id, tipo, ator_tipo, membro_id,
                                 credencial_id, autorizado_por_membro_id, origem, dados)
  values (p_empresa, p_vaga, p_candidatura, p_tipo, (p_ator ->> 'tipo')::public.rs_tipo_ator,
          (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid,
          (p_ator ->> 'autorizado_por_membro_id')::uuid,
          coalesce((p_ator ->> 'origem')::public.rs_origem_evento, p_origem), coalesce(p_dados, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- funções do 8.1 com 'web'
CREATE OR REPLACE FUNCTION public.rs_fn_aceita_convite(p_membro uuid, p_usuario uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_m public.rs_membros;
  v_u public.rs_usuarios;
  v_pessoa uuid;
begin
  select * into v_m from public.rs_membros where id = p_membro for update;
  select * into v_u from public.rs_usuarios where id = p_usuario;
  if v_m.id is null or v_m.removido_em is not null or v_m.usuario_id is not null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  if v_m.email operator(extensions.<>) v_u.email then
    raise exception 'convite_outro_email' using errcode = 'P0001';
  end if;
  if v_m.convite_expira_em <= pg_catalog.now() then
    raise exception 'convite_vencido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_membros where empresa_id = v_m.empresa_id and usuario_id = p_usuario
             and removido_em is null) then
    return false;
  end if;
  update public.rs_membros
     set usuario_id = p_usuario, aceito_em = pg_catalog.now(), convite_token_hash = null, convite_expira_em = null
   where id = p_membro;
  select id into v_pessoa from public.rs_pessoas
   where empresa_id = v_m.empresa_id and email operator(extensions.=) v_m.email and arquivada_em is null for update;
  if v_pessoa is null then
    insert into public.rs_pessoas (empresa_id, nome, email, membro_id)
    values (v_m.empresa_id, v_u.nome, v_m.email, p_membro);
  else
    update public.rs_pessoas set membro_id = p_membro where id = v_pessoa;
  end if;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_entrou',
    pg_catalog.jsonb_build_object('tipo', 'membro', 'membro_id', p_membro), 'web',
    pg_catalog.jsonb_build_object('membro_id', p_membro, 'papel', v_m.papel));
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_arquiva_area(p_area uuid, p_empresa uuid, p_ator jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.rs_areas where id = p_area and empresa_id = p_empresa and arquivada_em is null) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_vagas where area_id = p_area and status in ('publicada', 'pausada'))
     or exists (
       select 1 from public.rs_membro_areas ma join public.rs_membros m on m.id = ma.membro_id
        where ma.area_id = p_area and m.removido_em is null and m.papel = 'recrutador' and not m.todas_areas
          and not exists (select 1 from public.rs_membro_areas o join public.rs_areas a on a.id = o.area_id
                           where o.membro_id = m.id and o.area_id <> p_area and a.arquivada_em is null)
     ) then
    raise exception 'area_em_uso' using errcode = 'P0001';
  end if;
  update public.rs_areas set arquivada_em = pg_catalog.now() where id = p_area;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'area_arquivada', p_ator, 'web',
    pg_catalog.jsonb_build_object('area_id', p_area));
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_arquiva_pessoa(p_pessoa uuid, p_empresa uuid, p_ator jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_p public.rs_pessoas;
begin
  select * into v_p from public.rs_pessoas where id = p_pessoa and empresa_id = p_empresa and arquivada_em is null for update;
  if v_p.id is null then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
  if v_p.membro_id is not null then
    raise exception 'pessoa_com_acesso' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_vagas where dono_pessoa_id = p_pessoa and status in ('rascunho', 'publicada', 'pausada')) then
    raise exception 'pessoa_dona_de_vaga' using errcode = 'P0001';
  end if;
  update public.rs_areas set responsavel_pessoa_id = null where responsavel_pessoa_id = p_pessoa;
  update public.rs_pessoas set arquivada_em = pg_catalog.now() where id = p_pessoa;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'pessoa_arquivada', p_ator, 'web',
    pg_catalog.jsonb_build_object('pessoa_id', p_pessoa));
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_cancela_convite(p_membro uuid, p_ator jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_m public.rs_membros;
begin
  update public.rs_membros set removido_em = pg_catalog.now(), convite_token_hash = null
   where id = p_membro and usuario_id is null and removido_em is null
  returning * into v_m;
  if v_m.id is null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'convite_cancelado', p_ator, 'web',
    pg_catalog.jsonb_build_object('membro_id', p_membro));
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_convida_membro(p_empresa uuid, p_email text, p_papel rs_papel_membro, p_todas_areas boolean, p_areas uuid[], p_token_hash text, p_expira_em timestamp with time zone, p_max_pendentes integer, p_ator jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_membro uuid;
begin
  perform public.rs_fn_valida_areas(p_empresa, p_papel, p_todas_areas, p_areas);
  if (select count(*) from public.rs_membros where empresa_id = p_empresa and usuario_id is null
      and removido_em is null and convite_expira_em > pg_catalog.now()) >= p_max_pendentes then
    raise exception 'limite_convites' using errcode = 'P0001';
  end if;
  -- Convite vencido e não aceito do mesmo e-mail sai do caminho (pode ser convidado de novo).
  update public.rs_membros set removido_em = pg_catalog.now()
   where empresa_id = p_empresa and email operator(extensions.=) p_email::extensions.citext and usuario_id is null
     and removido_em is null and convite_expira_em <= pg_catalog.now();
  if exists (select 1 from public.rs_membros where empresa_id = p_empresa
             and email operator(extensions.=) p_email::extensions.citext and removido_em is null) then
    raise exception 'membro_ja_existe' using errcode = 'P0001';
  end if;
  insert into public.rs_membros (empresa_id, email, papel, todas_areas, convite_token_hash, convite_expira_em,
                                 convidado_por_membro_id)
  values (p_empresa, p_email, p_papel, p_papel <> 'recrutador' or p_todas_areas, p_token_hash, p_expira_em,
          (p_ator ->> 'membro_id')::uuid)
  returning id into v_membro;
  insert into public.rs_membro_areas (membro_id, area_id)
  select v_membro, a from pg_catalog.unnest(coalesce(p_areas, '{}')) a;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'membro_convidado', p_ator, 'web',
    pg_catalog.jsonb_build_object('membro_id', v_membro, 'papel', p_papel,
      'areas', coalesce(pg_catalog.cardinality(p_areas), 0)));
  return v_membro;
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_cria_empresa(p_usuario uuid, p_slug text, p_nome text, p_email_contato text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_u public.rs_usuarios;
  v_empresa uuid;
  v_membro uuid;
begin
  select * into v_u from public.rs_usuarios where id = p_usuario and suspenso_em is null;
  if v_u.id is null then
    raise exception 'usuario_invalido' using errcode = 'P0001';
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
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_muda_acesso(p_membro uuid, p_papel rs_papel_membro, p_todas_areas boolean, p_areas uuid[], p_ator jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_m public.rs_membros;
begin
  select * into v_m from public.rs_membros where id = p_membro and removido_em is null for update;
  if v_m.id is null then
    raise exception 'membro_invalido' using errcode = 'P0001';
  end if;
  if p_papel <> 'administrador' then
    perform public.rs_fn_garante_administrador(p_membro);
  end if;
  perform public.rs_fn_valida_areas(v_m.empresa_id, p_papel, p_todas_areas, p_areas);
  update public.rs_membros set papel = p_papel, todas_areas = (p_papel <> 'recrutador' or p_todas_areas)
   where id = p_membro;
  delete from public.rs_membro_areas where membro_id = p_membro;
  insert into public.rs_membro_areas (membro_id, area_id)
  select p_membro, a from pg_catalog.unnest(coalesce(p_areas, '{}')) a;
  update public.rs_credenciais set revogada_em = pg_catalog.now()
   where membro_id = p_membro and tipo = 'mcp' and revogada_em is null;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_acesso_alterado', p_ator, 'web',
    pg_catalog.jsonb_build_object('membro_id', p_membro, 'de', v_m.papel, 'para', p_papel,
      'areas', coalesce(pg_catalog.cardinality(p_areas), 0)));
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_reenvia_convite(p_membro uuid, p_token_hash text, p_expira_em timestamp with time zone, p_ator jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_m public.rs_membros;
begin
  update public.rs_membros set convite_token_hash = p_token_hash, convite_expira_em = p_expira_em
   where id = p_membro and usuario_id is null and removido_em is null
  returning * into v_m;
  if v_m.id is null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_convidado', p_ator, 'web',
    pg_catalog.jsonb_build_object('membro_id', p_membro, 'papel', v_m.papel, 'reenvio', true));
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_remove_membro(p_membro uuid, p_ator jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_m public.rs_membros;
begin
  select * into v_m from public.rs_membros where id = p_membro and removido_em is null
     and usuario_id is not null for update;
  if v_m.id is null then
    raise exception 'membro_invalido' using errcode = 'P0001';
  end if;
  perform public.rs_fn_garante_administrador(p_membro);
  update public.rs_membros set removido_em = pg_catalog.now() where id = p_membro;
  update public.rs_credenciais set revogada_em = pg_catalog.now()
   where membro_id = p_membro and tipo = 'mcp' and revogada_em is null;
  update public.rs_pessoas set membro_id = null where membro_id = p_membro;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_removido', p_ator, 'web',
    pg_catalog.jsonb_build_object('membro_id', p_membro));
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_salva_area(p_empresa uuid, p_id uuid, p_nome text, p_responsavel uuid, p_ator jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if p_responsavel is not null and not exists (
    select 1 from public.rs_pessoas where id = p_responsavel and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_areas where empresa_id = p_empresa and arquivada_em is null
             and pg_catalog.lower(nome) = pg_catalog.lower(p_nome) and id is distinct from p_id) then
    raise exception 'area_nome_em_uso' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.rs_areas (empresa_id, nome, responsavel_pessoa_id)
    values (p_empresa, p_nome, p_responsavel) returning id into v_id;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'area_criada', p_ator, 'web',
      pg_catalog.jsonb_build_object('area_id', v_id));
  else
    update public.rs_areas set nome = p_nome, responsavel_pessoa_id = p_responsavel
     where id = p_id and empresa_id = p_empresa and arquivada_em is null returning id into v_id;
    if v_id is null then
      raise exception 'area_invalida' using errcode = 'P0001';
    end if;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'area_editada', p_ator, 'web',
      pg_catalog.jsonb_build_object('area_id', v_id));
  end if;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.rs_fn_salva_pessoa(p_empresa uuid, p_id uuid, p_nome text, p_email text, p_cargo text, p_area uuid, p_recebe_resumo boolean, p_ator jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_atual public.rs_pessoas;
  v_id uuid;
begin
  if p_area is not null and not exists (
    select 1 from public.rs_areas where id = p_area and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_pessoas where empresa_id = p_empresa and arquivada_em is null
             and email operator(extensions.=) p_email::extensions.citext and id is distinct from p_id) then
    raise exception 'pessoa_email_em_uso' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.rs_pessoas (empresa_id, nome, email, cargo, area_id, recebe_resumo)
    values (p_empresa, p_nome, p_email, p_cargo, p_area, coalesce(p_recebe_resumo, true)) returning id into v_id;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'pessoa_cadastrada', p_ator, 'web',
      pg_catalog.jsonb_build_object('pessoa_id', v_id));
  else
    select * into v_atual from public.rs_pessoas where id = p_id and empresa_id = p_empresa and arquivada_em is null;
    if v_atual.id is null then
      raise exception 'pessoa_invalida' using errcode = 'P0001';
    end if;
    if v_atual.membro_id is not null and v_atual.email operator(extensions.<>) p_email::extensions.citext then
      raise exception 'pessoa_com_acesso_email' using errcode = 'P0001';
    end if;
    update public.rs_pessoas set nome = p_nome, email = p_email, cargo = p_cargo, area_id = p_area,
           recebe_resumo = coalesce(p_recebe_resumo, recebe_resumo)
     where id = p_id returning id into v_id;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'pessoa_editada', p_ator, 'web',
      pg_catalog.jsonb_build_object('pessoa_id', v_id));
  end if;
  return v_id;
end $function$

;

-- ---------------------------------------------------------------- OAuth do MCP (6.4)
alter table public.rs_oauth_codigos add column credencial_id uuid references public.rs_credenciais (id) on delete set null;
create index rs_oauth_codigos_credencial on public.rs_oauth_codigos (credencial_id);
create index rs_oauth_codigos_expira on public.rs_oauth_codigos (expira_em);

-- Cria o código de autorização depois do "Permitir" (6.4). Recebe o hash do código (o valor só
-- vai ao cliente), cliente, empresa, membro, escopos escolhidos, redirect, challenge S256 e a
-- validade em segundos (limits.ts). Recusa cliente inexistente, redirect não registrado,
-- challenge fora do formato e membro que não está ativo na empresa.
create function public.rs_fn_cria_codigo_oauth(
  p_codigo_hash text, p_cliente uuid, p_empresa uuid, p_membro uuid, p_escopos public.rs_escopo[],
  p_redirect_uri text, p_code_challenge text, p_validade_s integer
) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rs_oauth_clientes where id = p_cliente) then
    raise exception 'invalid_client' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_oauth_clientes where id = p_cliente and p_redirect_uri = any (redirect_uris))
     or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$' or coalesce(pg_catalog.cardinality(p_escopos), 0) = 0 then
    raise exception 'invalid_request' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_membros m join public.rs_empresas e on e.id = m.empresa_id
                 where m.id = p_membro and m.empresa_id = p_empresa and m.usuario_id is not null
                   and m.removido_em is null and e.excluida_em is null and e.suspensa_em is null) then
    raise exception 'membro_invalido' using errcode = 'P0001';
  end if;
  insert into public.rs_oauth_codigos (codigo_hash, cliente_id, empresa_id, membro_id, escopos, redirect_uri,
                                       code_challenge, expira_em)
  values (p_codigo_hash, p_cliente, p_empresa, p_membro, p_escopos, p_redirect_uri, p_code_challenge,
          pg_catalog.now() + pg_catalog.make_interval(secs => p_validade_s));
end $$;

-- Troca o código pelo token MCP (6.4). Recebe o hash do código, cliente, redirect, o S256 do
-- verifier (calculado no servidor), o hash e o prefixo do token novo. Devolve o id da credencial,
-- ou nulo se algo não bate. Código já usado revoga o token criado com ele (RFC 6749 §4.1.2) e
-- devolve nulo. Nunca levanta erro: a revogação não pode ser desfeita por rollback.
create function public.rs_fn_troca_codigo_oauth(
  p_codigo_hash text, p_cliente uuid, p_redirect_uri text, p_challenge_do_verifier text,
  p_token_hash text, p_token_prefixo text
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_c public.rs_oauth_codigos;
  v_nome text;
  v_cred uuid;
begin
  select * into v_c from public.rs_oauth_codigos where codigo_hash = p_codigo_hash for update;
  if v_c.codigo_hash is null then
    return null;
  end if;
  if v_c.usado_em is not null then
    update public.rs_credenciais set revogada_em = pg_catalog.now()
     where id = v_c.credencial_id and revogada_em is null;
    return null;
  end if;
  if v_c.expira_em <= pg_catalog.now() or v_c.cliente_id <> p_cliente or v_c.redirect_uri <> p_redirect_uri
     or v_c.code_challenge <> p_challenge_do_verifier then
    return null;
  end if;
  if not exists (select 1 from public.rs_membros m join public.rs_empresas e on e.id = m.empresa_id
                 where m.id = v_c.membro_id and m.empresa_id = v_c.empresa_id and m.removido_em is null
                   and e.excluida_em is null and e.suspensa_em is null) then
    return null;
  end if;
  select nome into v_nome from public.rs_oauth_clientes where id = v_c.cliente_id;
  insert into public.rs_credenciais (empresa_id, tipo, nome, prefixo, valor_hash, escopos, membro_id,
                                     oauth_cliente_id, criada_por_membro_id)
  values (v_c.empresa_id, 'mcp', coalesce(v_nome, 'Cliente MCP'), p_token_prefixo, p_token_hash, v_c.escopos,
          v_c.membro_id, v_c.cliente_id, v_c.membro_id)
  returning id into v_cred;
  update public.rs_oauth_codigos set usado_em = pg_catalog.now(), credencial_id = v_cred where codigo_hash = p_codigo_hash;
  perform public.rs_fn_registra_evento(v_c.empresa_id, null, null, 'mcp_conectado',
    pg_catalog.jsonb_build_object('tipo', 'membro', 'membro_id', v_c.membro_id, 'credencial_id', v_cred), 'web',
    pg_catalog.jsonb_build_object('credencial_id', v_cred, 'cliente_id', v_c.cliente_id, 'escopos', v_c.escopos));
  return v_cred;
end $$;

-- ---------------------------------------------------------------- chaves de API (6.3, 11.15)
-- Cria uma chave de API da empresa (só o hash e o prefixo; o valor aparece uma vez, no
-- formulário). Recusa passar do limite de chaves ativas (limits.ts). Devolve o id.
create function public.rs_fn_cria_chave_api(
  p_empresa uuid, p_nome text, p_prefixo text, p_valor_hash text, p_escopos public.rs_escopo[],
  p_max_ativas integer, p_ator jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from public.rs_credenciais where empresa_id = p_empresa and tipo = 'api' and revogada_em is null)
     >= p_max_ativas then
    raise exception 'limite_chaves' using errcode = 'P0001';
  end if;
  insert into public.rs_credenciais (empresa_id, tipo, nome, prefixo, valor_hash, escopos, criada_por_membro_id)
  values (p_empresa, 'api', p_nome, p_prefixo, p_valor_hash, p_escopos, (p_ator ->> 'membro_id')::uuid)
  returning id into v_id;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'credencial_criada', p_ator, 'web',
    pg_catalog.jsonb_build_object('credencial_id', v_id, 'tipo', 'api', 'escopos', p_escopos));
  return v_id;
end $$;

-- Revoga uma credencial (chave de API ou conexão do conector) da empresa. Quem pode revogar qual
-- (o membro as próprias conexões; o administrador todas e as chaves) é conferido no servidor.
create function public.rs_fn_revoga_credencial(p_credencial uuid, p_empresa uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_c public.rs_credenciais;
begin
  update public.rs_credenciais set revogada_em = pg_catalog.now()
   where id = p_credencial and empresa_id = p_empresa and revogada_em is null
  returning * into v_c;
  if v_c.id is null then
    raise exception 'credencial_invalida' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'credencial_revogada', p_ator, 'web',
    pg_catalog.jsonb_build_object('credencial_id', v_c.id, 'tipo', v_c.tipo));
end $$;

-- ---------------------------------------------------------------- privilégios (6.5, 20.3)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'rs\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
