-- Gerado por `npm run db:schema` (supabase db dump --local --schema public). Não editar à mão.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."rs_escopo" AS ENUM (
    'leitura',
    'escrita',
    'decisao'
);


ALTER TYPE "public"."rs_escopo" OWNER TO "postgres";


CREATE TYPE "public"."rs_mensagens_agente" AS ENUM (
    'confirmar',
    'direto'
);


ALTER TYPE "public"."rs_mensagens_agente" OWNER TO "postgres";


CREATE TYPE "public"."rs_modelo_trabalho" AS ENUM (
    'presencial',
    'hibrido',
    'remoto'
);


ALTER TYPE "public"."rs_modelo_trabalho" OWNER TO "postgres";


CREATE TYPE "public"."rs_motivo_encerramento_vaga" AS ENUM (
    'preenchida',
    'cancelada',
    'outro'
);


ALTER TYPE "public"."rs_motivo_encerramento_vaga" OWNER TO "postgres";


CREATE TYPE "public"."rs_motivo_reprovacao" AS ENUM (
    'requisitos',
    'experiencia',
    'perfil',
    'pretensao_salarial',
    'localizacao',
    'outro_candidato',
    'sem_retorno',
    'outro'
);


ALTER TYPE "public"."rs_motivo_reprovacao" OWNER TO "postgres";


CREATE TYPE "public"."rs_origem_candidatura" AS ENUM (
    'pagina',
    'api_publica',
    'integracao',
    'manual',
    'banco_talentos'
);


ALTER TYPE "public"."rs_origem_candidatura" OWNER TO "postgres";


CREATE TYPE "public"."rs_origem_evento" AS ENUM (
    'web',
    'api',
    'mcp',
    'publico',
    'cron',
    'formulario'
);


ALTER TYPE "public"."rs_origem_evento" OWNER TO "postgres";


CREATE TYPE "public"."rs_papel_membro" AS ENUM (
    'administrador',
    'recrutador',
    'avaliador'
);


ALTER TYPE "public"."rs_papel_membro" OWNER TO "postgres";


CREATE TYPE "public"."rs_papel_na_vaga" AS ENUM (
    'responsavel',
    'avaliador'
);


ALTER TYPE "public"."rs_papel_na_vaga" OWNER TO "postgres";


CREATE TYPE "public"."rs_recomendacao" AS ENUM (
    'forte_sim',
    'sim',
    'nao',
    'forte_nao'
);


ALTER TYPE "public"."rs_recomendacao" OWNER TO "postgres";


CREATE TYPE "public"."rs_regime" AS ENUM (
    'clt',
    'pj',
    'estagio',
    'temporario',
    'aprendiz',
    'trainee',
    'freelancer',
    'outro'
);


ALTER TYPE "public"."rs_regime" OWNER TO "postgres";


CREATE TYPE "public"."rs_situacao_candidatura" AS ENUM (
    'ativa',
    'reprovada',
    'desistiu',
    'contratada',
    'encerrada_vaga'
);


ALTER TYPE "public"."rs_situacao_candidatura" OWNER TO "postgres";


CREATE TYPE "public"."rs_status_decisao" AS ENUM (
    'pendente',
    'confirmada',
    'descartada',
    'expirada'
);


ALTER TYPE "public"."rs_status_decisao" OWNER TO "postgres";


CREATE TYPE "public"."rs_status_entrega" AS ENUM (
    'pendente',
    'entregue',
    'falhou',
    'desistiu'
);


ALTER TYPE "public"."rs_status_entrega" OWNER TO "postgres";


CREATE TYPE "public"."rs_status_extracao" AS ENUM (
    'pendente',
    'ok',
    'sem_texto',
    'falhou'
);


ALTER TYPE "public"."rs_status_extracao" OWNER TO "postgres";


CREATE TYPE "public"."rs_status_notificacao" AS ENUM (
    'pendente',
    'enviada',
    'falhou',
    'descartada'
);


ALTER TYPE "public"."rs_status_notificacao" OWNER TO "postgres";


CREATE TYPE "public"."rs_status_vaga" AS ENUM (
    'rascunho',
    'publicada',
    'pausada',
    'encerrada'
);


ALTER TYPE "public"."rs_status_vaga" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_arquivo" AS ENUM (
    'curriculo',
    'anexo',
    'logo'
);


ALTER TYPE "public"."rs_tipo_arquivo" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_ator" AS ENUM (
    'membro',
    'candidato',
    'sistema',
    'api',
    'agente'
);


ALTER TYPE "public"."rs_tipo_ator" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_credencial" AS ENUM (
    'api',
    'mcp'
);


ALTER TYPE "public"."rs_tipo_credencial" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_decisao" AS ENUM (
    'reprovar',
    'contratar',
    'encerrar_vaga',
    'enviar_mensagem'
);


ALTER TYPE "public"."rs_tipo_decisao" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_etapa" AS ENUM (
    'triagem',
    'entrevista',
    'avaliacao',
    'proposta'
);


ALTER TYPE "public"."rs_tipo_etapa" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_mensagem" AS ENUM (
    'confirmacao',
    'devolutiva',
    'contato',
    'convite_vaga',
    'desistencia',
    'resposta_revisao'
);


ALTER TYPE "public"."rs_tipo_mensagem" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_notificacao" AS ENUM (
    'convite_membro',
    'candidatura_recebida',
    'mensagem_candidato',
    'links_reenviados',
    'codigo_exclusao',
    'resumo_diario',
    'decisoes_pendentes',
    'revisao_pedida',
    'talentos_expirando',
    'resumo_dono_vaga'
);


ALTER TYPE "public"."rs_tipo_notificacao" OWNER TO "postgres";


CREATE TYPE "public"."rs_tipo_pergunta" AS ENUM (
    'texto_curto',
    'texto_longo',
    'sim_nao',
    'escolha_unica',
    'numero'
);


ALTER TYPE "public"."rs_tipo_pergunta" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_aceita_convite"("p_membro" "uuid", "p_usuario" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_aceita_convite"("p_membro" "uuid", "p_usuario" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_arquiva_area"("p_area" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_arquiva_area"("p_area" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_arquiva_pessoa"("p_pessoa" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_arquiva_pessoa"("p_pessoa" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_cancela_convite"("p_membro" "uuid", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_cancela_convite"("p_membro" "uuid", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_convida_membro"("p_empresa" "uuid", "p_email" "text", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_convida_membro"("p_empresa" "uuid", "p_email" "text", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_cria_chave_api"("p_empresa" "uuid", "p_nome" "text", "p_prefixo" "text", "p_valor_hash" "text", "p_escopos" "public"."rs_escopo"[], "p_max_ativas" integer, "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."rs_fn_cria_chave_api"("p_empresa" "uuid", "p_nome" "text", "p_prefixo" "text", "p_valor_hash" "text", "p_escopos" "public"."rs_escopo"[], "p_max_ativas" integer, "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_cria_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_empresa" "uuid", "p_membro" "uuid", "p_escopos" "public"."rs_escopo"[], "p_redirect_uri" "text", "p_code_challenge" "text", "p_validade_s" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
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
end $_$;


ALTER FUNCTION "public"."rs_fn_cria_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_empresa" "uuid", "p_membro" "uuid", "p_escopos" "public"."rs_escopo"[], "p_redirect_uri" "text", "p_code_challenge" "text", "p_validade_s" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_cria_empresa"("p_usuario" "uuid", "p_slug" "text", "p_nome" "text", "p_email_contato" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_cria_empresa"("p_usuario" "uuid", "p_slug" "text", "p_nome" "text", "p_email_contato" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_da_acesso"("p_pessoa" "uuid", "p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_p public.rs_pessoas;
begin
  select * into v_p from public.rs_pessoas where id = p_pessoa and empresa_id = p_empresa and arquivada_em is null;
  if v_p.id is null then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
  if v_p.membro_id is not null then
    raise exception 'pessoa_com_acesso' using errcode = 'P0001';
  end if;
  return public.rs_fn_convida_membro(p_empresa, v_p.email::text, p_papel, p_todas_areas, p_areas,
                                     p_token_hash, p_expira_em, p_max_pendentes, p_ator);
end $$;


ALTER FUNCTION "public"."rs_fn_da_acesso"("p_pessoa" "uuid", "p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_entra_usuario"("p_google_sub" "text", "p_email" "text", "p_nome" "text", "p_foto" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_u public.rs_usuarios;
  v_novo boolean := false;
  v_convite record;
begin
  select * into v_u from public.rs_usuarios where google_sub = p_google_sub for update;
  if v_u.id is not null and v_u.suspenso_em is not null then
    raise exception 'usuario_suspenso' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_usuarios where email operator(extensions.=) p_email::extensions.citext
             and google_sub <> p_google_sub) then
    raise exception 'email_em_uso' using errcode = 'P0001';
  end if;
  if v_u.id is null then
    insert into public.rs_usuarios (email, nome, google_sub, foto_url, ultimo_acesso_em)
    values (p_email, p_nome, p_google_sub, p_foto, pg_catalog.now())
    returning * into v_u;
    v_novo := true;
  else
    update public.rs_usuarios
       set email = p_email, nome = p_nome, foto_url = p_foto, ultimo_acesso_em = pg_catalog.now()
     where id = v_u.id
    returning * into v_u;
  end if;
  for v_convite in
    select m.id from public.rs_membros m join public.rs_empresas e on e.id = m.empresa_id
     where m.email operator(extensions.=) v_u.email and m.usuario_id is null and m.removido_em is null
       and m.convite_expira_em > pg_catalog.now() and e.excluida_em is null
  loop
    perform public.rs_fn_aceita_convite(v_convite.id, v_u.id);
  end loop;
  return pg_catalog.jsonb_build_object(
    'usuario_id', v_u.id,
    'novo', v_novo,
    'empresas', coalesce((
      select pg_catalog.jsonb_agg(e.slug order by e.nome)
        from public.rs_membros m join public.rs_empresas e on e.id = m.empresa_id
       where m.usuario_id = v_u.id and m.removido_em is null and e.excluida_em is null
    ), '[]'::jsonb));
end $$;


ALTER FUNCTION "public"."rs_fn_entra_usuario"("p_google_sub" "text", "p_email" "text", "p_nome" "text", "p_foto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_expurga_empresa"("p_empresa" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not exists (select 1 from public.rs_empresas where id = p_empresa
                 and excluida_em <= pg_catalog.now() - interval '7 days') then
    raise exception 'empresa_nao_expurgavel' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('rs.expurgo_empresa', p_empresa::text, true);
  delete from public.rs_empresas where id = p_empresa;
  perform pg_catalog.set_config('rs.expurgo_empresa', '', true);
end $$;


ALTER FUNCTION "public"."rs_fn_expurga_empresa"("p_empresa" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_garante_administrador"("p_membro" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."rs_fn_garante_administrador"("p_membro" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_muda_acesso"("p_membro" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_muda_acesso"("p_membro" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_reenvia_convite"("p_membro" "uuid", "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_reenvia_convite"("p_membro" "uuid", "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_registra_evento"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidatura" "uuid", "p_tipo" "text", "p_ator" "jsonb", "p_origem" "public"."rs_origem_evento", "p_dados" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."rs_fn_registra_evento"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidatura" "uuid", "p_tipo" "text", "p_ator" "jsonb", "p_origem" "public"."rs_origem_evento", "p_dados" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_remove_membro"("p_membro" "uuid", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_remove_membro"("p_membro" "uuid", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_revoga_credencial"("p_credencial" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."rs_fn_revoga_credencial"("p_credencial" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_salva_area"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_responsavel" "uuid", "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_salva_area"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_responsavel" "uuid", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_salva_pessoa"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_email" "text", "p_cargo" "text", "p_area" "uuid", "p_recebe_resumo" boolean, "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
end $$;


ALTER FUNCTION "public"."rs_fn_salva_pessoa"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_email" "text", "p_cargo" "text", "p_area" "uuid", "p_recebe_resumo" boolean, "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_troca_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_redirect_uri" "text", "p_challenge_do_verifier" "text", "p_token_hash" "text", "p_token_prefixo" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."rs_fn_troca_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_redirect_uri" "text", "p_challenge_do_verifier" "text", "p_token_hash" "text", "p_token_prefixo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_valida_areas"("p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas" boolean, "p_areas" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if p_papel <> 'recrutador' or p_todas then
    if coalesce(pg_catalog.cardinality(p_areas), 0) > 0 then
      raise exception 'areas_so_para_recrutador_limitado' using errcode = 'P0001';
    end if;
    return;
  end if;
  if coalesce(pg_catalog.cardinality(p_areas), 0) = 0 then
    raise exception 'recrutador_sem_area' using errcode = 'P0001';
  end if;
  if (select count(*) from public.rs_areas
      where id = any (p_areas) and empresa_id = p_empresa and arquivada_em is null)
     <> (select count(distinct a) from pg_catalog.unnest(p_areas) a) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_valida_areas"("p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas" boolean, "p_areas" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_tg_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.atualizado_em := pg_catalog.now();
  return new;
end $$;


ALTER FUNCTION "public"."rs_tg_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_tg_etapa_da_vaga"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.rs_vagas where id = new.vaga_id;
  if v_empresa is distinct from new.empresa_id then
    raise exception 'empresa_diferente_da_vaga' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_candidatos where id = new.candidato_id and empresa_id = new.empresa_id) then
    raise exception 'candidato_de_outra_empresa' using errcode = 'P0001';
  end if;
  if new.etapa_id is not null and not exists (
    select 1 from public.rs_etapas where id = new.etapa_id and vaga_id = new.vaga_id
  ) then
    raise exception 'etapa_de_outra_vaga' using errcode = 'P0001';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."rs_tg_etapa_da_vaga"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_tg_eventos_imutaveis"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' and pg_catalog.current_setting('rs.expurgo_empresa', true) = old.empresa_id::text then
    return old;
  end if;
  raise exception 'trilha_imutavel' using errcode = 'P0001';
end $$;


ALTER FUNCTION "public"."rs_tg_eventos_imutaveis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_tg_situacao_candidatura"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.situacao <> 'ativa' then
      raise exception 'candidatura_nasce_ativa' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.situacao is distinct from old.situacao then
    if coalesce(pg_catalog.current_setting('rs.transicao', true), '') <> 'on' then
      raise exception 'situacao_so_por_funcao' using errcode = 'P0001';
    end if;
    if not (
      (old.situacao = 'ativa' and new.situacao in ('reprovada', 'desistiu', 'contratada', 'encerrada_vaga'))
      or (old.situacao in ('reprovada', 'desistiu', 'contratada') and new.situacao = 'ativa')
    ) then
      raise exception 'transicao_proibida' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."rs_tg_situacao_candidatura"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_tg_vaga_congelada"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_vaga public.rs_vagas;
begin
  if tg_table_name = 'rs_vagas' then
    if pg_catalog.current_setting('rs.expurgo_empresa', true) = old.empresa_id::text then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    if tg_op = 'DELETE' then
      if old.status <> 'rascunho' then
        raise exception 'vaga_so_apaga_rascunho' using errcode = 'P0001';
      end if;
      return old;
    end if;
    if old.status = 'encerrada' then
      raise exception 'vaga_encerrada' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- rs_perguntas
  select * into v_vaga from public.rs_vagas where id = coalesce(new.vaga_id, old.vaga_id);
  if not found then
    return case when tg_op = 'DELETE' then old else new end; -- vaga em rascunho sendo apagada
  end if;
  if pg_catalog.current_setting('rs.expurgo_empresa', true) = v_vaga.empresa_id::text then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_vaga.publicada_em is not null then
    raise exception 'perguntas_congeladas' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;


ALTER FUNCTION "public"."rs_tg_vaga_congelada"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."rs_areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "responsavel_pessoa_id" "uuid",
    "arquivada_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_areas_nome_tamanho" CHECK ((("char_length"("nome") >= 2) AND ("char_length"("nome") <= 60)))
);


ALTER TABLE "public"."rs_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_arquivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "candidatura_id" "uuid",
    "tipo" "public"."rs_tipo_arquivo" NOT NULL,
    "path" "text" NOT NULL,
    "nome_original" "text" NOT NULL,
    "mime" "text" NOT NULL,
    "bytes" integer NOT NULL,
    "sha256" "text",
    "texto_extraido" "text",
    "extracao_status" "public"."rs_status_extracao" DEFAULT 'pendente'::"public"."rs_status_extracao" NOT NULL,
    "confirmado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_arquivos_bytes" CHECK (("bytes" > 0)),
    CONSTRAINT "rs_arquivos_dono" CHECK ((("tipo" = 'logo'::"public"."rs_tipo_arquivo") = ("candidatura_id" IS NULL))),
    CONSTRAINT "rs_arquivos_texto_tamanho" CHECK (("char_length"("texto_extraido") <= 100000))
);


ALTER TABLE "public"."rs_arquivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_avaliacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidatura_id" "uuid" NOT NULL,
    "etapa_id" "uuid" NOT NULL,
    "membro_id" "uuid" NOT NULL,
    "recomendacao" "public"."rs_recomendacao" NOT NULL,
    "comentario" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_avaliacoes_comentario" CHECK ((("comentario" = ''::"text") OR (("char_length"("comentario") >= 10) AND ("char_length"("comentario") <= 5000))))
);


ALTER TABLE "public"."rs_avaliacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_candidatos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "email" "extensions"."citext",
    "nome" "text" NOT NULL,
    "telefone" "text",
    "linkedin_url" "text",
    "cidade" "text",
    "talentos_consentido_em" timestamp with time zone,
    "talentos_expira_em" timestamp with time zone,
    "anonimizado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_candidatos_cidade_tamanho" CHECK (("char_length"("cidade") <= 120)),
    CONSTRAINT "rs_candidatos_linkedin" CHECK (("linkedin_url" ~ '^https://(www\.)?linkedin\.com/in/'::"text")),
    CONSTRAINT "rs_candidatos_nome_tamanho" CHECK ((("char_length"("nome") >= 2) AND ("char_length"("nome") <= 120))),
    CONSTRAINT "rs_candidatos_telefone" CHECK (("telefone" ~ '^[0-9]{10,13}$'::"text"))
);


ALTER TABLE "public"."rs_candidatos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_candidaturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "vaga_id" "uuid" NOT NULL,
    "candidato_id" "uuid" NOT NULL,
    "etapa_id" "uuid",
    "situacao" "public"."rs_situacao_candidatura" DEFAULT 'ativa'::"public"."rs_situacao_candidatura" NOT NULL,
    "origem" "public"."rs_origem_candidatura" NOT NULL,
    "token_hash" "text" NOT NULL,
    "consentimento_versao" "text" NOT NULL,
    "consentimento_em" timestamp with time zone NOT NULL,
    "sinalizada" boolean DEFAULT false NOT NULL,
    "texto_busca" "tsvector",
    "movida_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "motivo_reprovacao" "public"."rs_motivo_reprovacao",
    "encerrada_em" timestamp with time zone,
    "expurgar_em" timestamp with time zone,
    "revisao_pedida_em" timestamp with time zone,
    "revisao_respondida_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_candidaturas_encerramento" CHECK ((("situacao" = 'ativa'::"public"."rs_situacao_candidatura") = ("encerrada_em" IS NULL))),
    CONSTRAINT "rs_candidaturas_expurgo" CHECK ((("situacao" <> 'ativa'::"public"."rs_situacao_candidatura") OR ("expurgar_em" IS NULL))),
    CONSTRAINT "rs_candidaturas_motivo" CHECK ((("motivo_reprovacao" IS NULL) OR ("situacao" = 'reprovada'::"public"."rs_situacao_candidatura")))
);


ALTER TABLE "public"."rs_candidaturas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_credenciais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo" "public"."rs_tipo_credencial" NOT NULL,
    "nome" "text" NOT NULL,
    "prefixo" "text" NOT NULL,
    "valor_hash" "text" NOT NULL,
    "escopos" "public"."rs_escopo"[] NOT NULL,
    "membro_id" "uuid",
    "oauth_cliente_id" "uuid",
    "criada_por_membro_id" "uuid" NOT NULL,
    "ultimo_uso_em" timestamp with time zone,
    "revogada_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_credenciais_cliente" CHECK ((("tipo" = 'mcp'::"public"."rs_tipo_credencial") OR ("oauth_cliente_id" IS NULL))),
    CONSTRAINT "rs_credenciais_escopos" CHECK (("cardinality"("escopos") > 0)),
    CONSTRAINT "rs_credenciais_membro" CHECK ((("tipo" = 'mcp'::"public"."rs_tipo_credencial") = ("membro_id" IS NOT NULL))),
    CONSTRAINT "rs_credenciais_nome" CHECK ((("char_length"("nome") >= 1) AND ("char_length"("nome") <= 100)))
);


ALTER TABLE "public"."rs_credenciais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_decisoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "tipo" "public"."rs_tipo_decisao" NOT NULL,
    "candidatura_id" "uuid",
    "vaga_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "justificativa" "text",
    "status" "public"."rs_status_decisao" DEFAULT 'pendente'::"public"."rs_status_decisao" NOT NULL,
    "proposta_por_tipo" "public"."rs_tipo_ator" NOT NULL,
    "proposta_por_membro_id" "uuid",
    "credencial_id" "uuid" NOT NULL,
    "decidida_por_membro_id" "uuid",
    "decidida_em" timestamp with time zone,
    "expira_em" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_decisoes_alvo" CHECK (((("tipo" = 'encerrar_vaga'::"public"."rs_tipo_decisao") AND ("vaga_id" IS NOT NULL) AND ("candidatura_id" IS NULL)) OR (("tipo" <> 'encerrar_vaga'::"public"."rs_tipo_decisao") AND ("candidatura_id" IS NOT NULL)))),
    CONSTRAINT "rs_decisoes_justificativa" CHECK (("char_length"("justificativa") <= 2000)),
    CONSTRAINT "rs_decisoes_proponente" CHECK (("proposta_por_tipo" = ANY (ARRAY['api'::"public"."rs_tipo_ator", 'agente'::"public"."rs_tipo_ator"])))
);


ALTER TABLE "public"."rs_decisoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "site_url" "text",
    "logo_path" "text",
    "cor_destaque" "text",
    "email_contato" "extensions"."citext" NOT NULL,
    "pagina_publicada" boolean DEFAULT false NOT NULL,
    "retencao_dias" smallint DEFAULT 180 NOT NULL,
    "talentos_meses" smallint DEFAULT 12 NOT NULL,
    "mensagens_agente" "public"."rs_mensagens_agente" DEFAULT 'confirmar'::"public"."rs_mensagens_agente" NOT NULL,
    "aviso_privacidade_extra" "text",
    "criada_por_usuario_id" "uuid" NOT NULL,
    "suspensa_em" timestamp with time zone,
    "excluida_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_empresas_aviso_tamanho" CHECK (("char_length"("aviso_privacidade_extra") <= 1000)),
    CONSTRAINT "rs_empresas_cor_formato" CHECK (("cor_destaque" ~ '^#[0-9a-f]{6}$'::"text")),
    CONSTRAINT "rs_empresas_descricao_tamanho" CHECK (("char_length"("descricao") <= 2000)),
    CONSTRAINT "rs_empresas_nome_tamanho" CHECK ((("char_length"("nome") >= 2) AND ("char_length"("nome") <= 80))),
    CONSTRAINT "rs_empresas_retencao" CHECK ((("retencao_dias" >= 90) AND ("retencao_dias" <= 365))),
    CONSTRAINT "rs_empresas_site_https" CHECK (("site_url" ~ '^https://'::"text")),
    CONSTRAINT "rs_empresas_slug_formato" CHECK ((("slug" ~ '^[a-z0-9](-?[a-z0-9])*$'::"text") AND (("char_length"("slug") >= 3) AND ("char_length"("slug") <= 40)))),
    CONSTRAINT "rs_empresas_talentos" CHECK ((("talentos_meses" >= 6) AND ("talentos_meses" <= 24)))
);


ALTER TABLE "public"."rs_empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_entregas_webhook" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "webhook_id" "uuid" NOT NULL,
    "evento_id" bigint NOT NULL,
    "tipo" "text" NOT NULL,
    "corpo" "jsonb" NOT NULL,
    "status" "public"."rs_status_entrega" DEFAULT 'pendente'::"public"."rs_status_entrega" NOT NULL,
    "tentativas" smallint DEFAULT 0 NOT NULL,
    "ultimo_status_http" smallint,
    "proxima_tentativa_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reservada_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entregue_em" timestamp with time zone,
    CONSTRAINT "rs_entregas_tentativas" CHECK ((("tentativas" >= 0) AND ("tentativas" <= 8)))
);


ALTER TABLE "public"."rs_entregas_webhook" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_etapas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vaga_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "public"."rs_tipo_etapa" NOT NULL,
    "ordem" smallint NOT NULL,
    CONSTRAINT "rs_etapas_nome_tamanho" CHECK ((("char_length"("nome") >= 2) AND ("char_length"("nome") <= 40)))
);


ALTER TABLE "public"."rs_etapas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_eventos" (
    "id" bigint NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "vaga_id" "uuid",
    "candidatura_id" "uuid",
    "tipo" "text" NOT NULL,
    "ator_tipo" "public"."rs_tipo_ator" NOT NULL,
    "membro_id" "uuid",
    "credencial_id" "uuid",
    "autorizado_por_membro_id" "uuid",
    "origem" "public"."rs_origem_evento" NOT NULL,
    "dados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_eventos_tipo_catalogo" CHECK (("tipo" = ANY (ARRAY['empresa_criada'::"text", 'membro_convidado'::"text", 'convite_cancelado'::"text", 'membro_entrou'::"text", 'membro_acesso_alterado'::"text", 'membro_removido'::"text", 'area_criada'::"text", 'area_editada'::"text", 'area_arquivada'::"text", 'pessoa_cadastrada'::"text", 'pessoa_editada'::"text", 'pessoa_arquivada'::"text", 'acesso_pedido'::"text", 'vaga_dono_alterado'::"text", 'credencial_criada'::"text", 'credencial_revogada'::"text", 'mcp_conectado'::"text", 'vaga_criada'::"text", 'vaga_editada'::"text", 'vaga_publicada'::"text", 'vaga_pausada'::"text", 'vaga_pausada_prazo'::"text", 'vaga_encerrada'::"text", 'candidatura_criada'::"text", 'etapa_alterada'::"text", 'nota_adicionada'::"text", 'avaliacao_registrada'::"text", 'mensagem_enviada'::"text", 'candidatura_reprovada'::"text", 'candidatura_contratada'::"text", 'candidatura_desistiu'::"text", 'candidatura_encerrada_vaga'::"text", 'candidatura_reaberta'::"text", 'decisao_proposta'::"text", 'decisao_confirmada'::"text", 'decisao_descartada'::"text", 'decisao_expirada'::"text", 'revisao_pedida'::"text", 'revisao_respondida'::"text", 'dados_exportados'::"text", 'dados_excluidos'::"text", 'candidatura_anonimizada'::"text", 'talentos_consentido'::"text", 'talentos_retirado'::"text", 'talentos_convidado'::"text", 'candidaturas_exportadas'::"text"])))
);


ALTER TABLE "public"."rs_eventos" OWNER TO "postgres";


ALTER TABLE "public"."rs_eventos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rs_eventos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rs_membro_areas" (
    "membro_id" "uuid" NOT NULL,
    "area_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rs_membro_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_membros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "usuario_id" "uuid",
    "email" "extensions"."citext" NOT NULL,
    "papel" "public"."rs_papel_membro" NOT NULL,
    "todas_areas" boolean DEFAULT true NOT NULL,
    "link_agenda" "text",
    "convite_token_hash" "text",
    "convite_expira_em" timestamp with time zone,
    "convidado_por_membro_id" "uuid",
    "aceito_em" timestamp with time zone,
    "removido_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_membros_agenda_https" CHECK (("link_agenda" ~ '^https://'::"text")),
    CONSTRAINT "rs_membros_convite_coerente" CHECK (((("usuario_id" IS NULL) AND ("aceito_em" IS NULL)) OR (("usuario_id" IS NOT NULL) AND ("aceito_em" IS NOT NULL) AND ("convite_token_hash" IS NULL) AND ("convite_expira_em" IS NULL)))),
    CONSTRAINT "rs_membros_todas_areas" CHECK (("todas_areas" OR ("papel" = 'recrutador'::"public"."rs_papel_membro")))
);


ALTER TABLE "public"."rs_membros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_mensagens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "candidatura_id" "uuid" NOT NULL,
    "tipo" "public"."rs_tipo_mensagem" NOT NULL,
    "assunto" "text" NOT NULL,
    "corpo" "text" NOT NULL,
    "ator_tipo" "public"."rs_tipo_ator" NOT NULL,
    "membro_id" "uuid",
    "credencial_id" "uuid",
    "decisao_id" "uuid",
    "notificacao_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rs_mensagens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_modelos_mensagem" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "chave" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "assunto" "text" NOT NULL,
    "corpo" "text" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_modelos_assunto" CHECK ((("char_length"("assunto") >= 2) AND ("char_length"("assunto") <= 200))),
    CONSTRAINT "rs_modelos_chave" CHECK (("chave" ~ '^[a-z0-9_]{2,60}$'::"text")),
    CONSTRAINT "rs_modelos_corpo" CHECK ((("char_length"("corpo") >= 2) AND ("char_length"("corpo") <= 5000))),
    CONSTRAINT "rs_modelos_nome" CHECK ((("char_length"("nome") >= 2) AND ("char_length"("nome") <= 80)))
);


ALTER TABLE "public"."rs_modelos_mensagem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_notas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidatura_id" "uuid" NOT NULL,
    "texto" "text" NOT NULL,
    "ator_tipo" "public"."rs_tipo_ator" NOT NULL,
    "membro_id" "uuid",
    "credencial_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_notas_ator" CHECK (("ator_tipo" = ANY (ARRAY['membro'::"public"."rs_tipo_ator", 'api'::"public"."rs_tipo_ator", 'agente'::"public"."rs_tipo_ator"]))),
    CONSTRAINT "rs_notas_texto_tamanho" CHECK ((("char_length"("texto") >= 1) AND ("char_length"("texto") <= 10000)))
);


ALTER TABLE "public"."rs_notas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_notificacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "candidatura_id" "uuid",
    "tipo" "public"."rs_tipo_notificacao" NOT NULL,
    "destinatario" "extensions"."citext" NOT NULL,
    "chave_idempotencia" "text" NOT NULL,
    "assunto" "text" NOT NULL,
    "html" "text" NOT NULL,
    "texto" "text" NOT NULL,
    "reply_to" "extensions"."citext",
    "status" "public"."rs_status_notificacao" DEFAULT 'pendente'::"public"."rs_status_notificacao" NOT NULL,
    "tentativas" smallint DEFAULT 0 NOT NULL,
    "ultimo_erro" "text",
    "enviar_apos" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enviada_em" timestamp with time zone,
    "resend_id" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rs_notificacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_oauth_clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" DEFAULT 'Cliente MCP'::"text" NOT NULL,
    "redirect_uris" "text"[] NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_oauth_clientes_nome" CHECK (("char_length"("nome") <= 100)),
    CONSTRAINT "rs_oauth_clientes_uris" CHECK ((("cardinality"("redirect_uris") >= 1) AND ("cardinality"("redirect_uris") <= 5)))
);


ALTER TABLE "public"."rs_oauth_clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_oauth_codigos" (
    "codigo_hash" "text" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "membro_id" "uuid" NOT NULL,
    "escopos" "public"."rs_escopo"[] NOT NULL,
    "redirect_uri" "text" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "expira_em" timestamp with time zone DEFAULT ("now"() + '00:10:00'::interval) NOT NULL,
    "usado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "credencial_id" "uuid",
    CONSTRAINT "rs_oauth_codigos_escopos" CHECK (("cardinality"("escopos") > 0))
);


ALTER TABLE "public"."rs_oauth_codigos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_perguntas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vaga_id" "uuid" NOT NULL,
    "ordem" smallint NOT NULL,
    "texto" "text" NOT NULL,
    "tipo" "public"."rs_tipo_pergunta" NOT NULL,
    "opcoes" "text"[],
    "obrigatoria" boolean DEFAULT true NOT NULL,
    "resposta_esperada" "text",
    CONSTRAINT "rs_perguntas_opcoes" CHECK (((("tipo" = 'escolha_unica'::"public"."rs_tipo_pergunta") AND ("opcoes" IS NOT NULL) AND (("cardinality"("opcoes") >= 2) AND ("cardinality"("opcoes") <= 10))) OR (("tipo" <> 'escolha_unica'::"public"."rs_tipo_pergunta") AND ("opcoes" IS NULL)))),
    CONSTRAINT "rs_perguntas_resposta_esperada" CHECK ((("resposta_esperada" IS NULL) OR ("tipo" = ANY (ARRAY['sim_nao'::"public"."rs_tipo_pergunta", 'escolha_unica'::"public"."rs_tipo_pergunta"])))),
    CONSTRAINT "rs_perguntas_texto_tamanho" CHECK ((("char_length"("texto") >= 3) AND ("char_length"("texto") <= 300)))
);


ALTER TABLE "public"."rs_perguntas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_pessoas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "extensions"."citext" NOT NULL,
    "cargo" "text",
    "area_id" "uuid",
    "membro_id" "uuid",
    "recebe_resumo" boolean DEFAULT true NOT NULL,
    "arquivada_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_pessoas_cargo_tamanho" CHECK (("char_length"("cargo") <= 120)),
    CONSTRAINT "rs_pessoas_nome_tamanho" CHECK ((("char_length"("nome") >= 2) AND ("char_length"("nome") <= 120)))
);


ALTER TABLE "public"."rs_pessoas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_respostas" (
    "candidatura_id" "uuid" NOT NULL,
    "pergunta_id" "uuid" NOT NULL,
    "valor" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_respostas_valor_tamanho" CHECK (("char_length"("valor") <= 3000))
);


ALTER TABLE "public"."rs_respostas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "extensions"."citext" NOT NULL,
    "nome" "text" NOT NULL,
    "google_sub" "text" NOT NULL,
    "foto_url" "text",
    "termos_aceitos_em" timestamp with time zone,
    "suspenso_em" timestamp with time zone,
    "ultimo_acesso_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rs_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_vaga_equipe" (
    "vaga_id" "uuid" NOT NULL,
    "membro_id" "uuid" NOT NULL,
    "papel_na_vaga" "public"."rs_papel_na_vaga" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rs_vaga_equipe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_vagas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text" DEFAULT ''::"text" NOT NULL,
    "requisitos" "text",
    "area_id" "uuid",
    "dono_pessoa_id" "uuid",
    "modelo_trabalho" "public"."rs_modelo_trabalho" DEFAULT 'presencial'::"public"."rs_modelo_trabalho" NOT NULL,
    "cidade" "text",
    "uf" character(2),
    "regime" "public"."rs_regime" DEFAULT 'clt'::"public"."rs_regime" NOT NULL,
    "salario_min" numeric(12,2),
    "salario_max" numeric(12,2),
    "salario_periodo" "text",
    "mostrar_salario" boolean DEFAULT false NOT NULL,
    "curriculo_obrigatorio" boolean DEFAULT true NOT NULL,
    "status" "public"."rs_status_vaga" DEFAULT 'rascunho'::"public"."rs_status_vaga" NOT NULL,
    "encerra_em" "date",
    "publicada_em" timestamp with time zone,
    "encerrada_em" timestamp with time zone,
    "motivo_encerramento" "public"."rs_motivo_encerramento_vaga",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_vagas_descricao_tamanho" CHECK (("char_length"("descricao") <= 20000)),
    CONSTRAINT "rs_vagas_encerrada" CHECK ((("status" <> 'encerrada'::"public"."rs_status_vaga") OR (("motivo_encerramento" IS NOT NULL) AND ("encerrada_em" IS NOT NULL)))),
    CONSTRAINT "rs_vagas_local" CHECK ((("modelo_trabalho" = 'remoto'::"public"."rs_modelo_trabalho") OR (("cidade" IS NOT NULL) AND ("uf" IS NOT NULL)))),
    CONSTRAINT "rs_vagas_requisitos_tamanho" CHECK (("char_length"("requisitos") <= 5000)),
    CONSTRAINT "rs_vagas_salario" CHECK (((("salario_min" IS NULL) OR ("salario_min" > (0)::numeric)) AND (("salario_max" IS NULL) OR ("salario_max" > (0)::numeric)) AND (("salario_min" IS NULL) OR ("salario_max" IS NULL) OR ("salario_max" >= "salario_min")) AND ((("salario_min" IS NULL) AND ("salario_max" IS NULL)) OR ("salario_periodo" IS NOT NULL)))),
    CONSTRAINT "rs_vagas_salario_periodo" CHECK (("salario_periodo" = ANY (ARRAY['mes'::"text", 'hora'::"text"]))),
    CONSTRAINT "rs_vagas_slug_formato" CHECK ((("slug" ~ '^[a-z0-9](-?[a-z0-9])*$'::"text") AND ("char_length"("slug") <= 140))),
    CONSTRAINT "rs_vagas_titulo_tamanho" CHECK ((("char_length"("titulo") >= 3) AND ("char_length"("titulo") <= 120))),
    CONSTRAINT "rs_vagas_uf_formato" CHECK (("uf" ~ '^[A-Z]{2}$'::"text"))
);


ALTER TABLE "public"."rs_vagas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "segredo_cifrado" "text" NOT NULL,
    "eventos" "text"[] NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_webhooks_eventos" CHECK (("cardinality"("eventos") > 0)),
    CONSTRAINT "rs_webhooks_https" CHECK (("url" ~ '^https://'::"text"))
);


ALTER TABLE "public"."rs_webhooks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."rs_areas"
    ADD CONSTRAINT "rs_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_arquivos"
    ADD CONSTRAINT "rs_arquivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_avaliacoes"
    ADD CONSTRAINT "rs_avaliacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_avaliacoes"
    ADD CONSTRAINT "rs_avaliacoes_uma_por_membro" UNIQUE ("candidatura_id", "etapa_id", "membro_id");



ALTER TABLE ONLY "public"."rs_candidatos"
    ADD CONSTRAINT "rs_candidatos_email_unico" UNIQUE ("empresa_id", "email");



ALTER TABLE ONLY "public"."rs_candidatos"
    ADD CONSTRAINT "rs_candidatos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_uma_por_vaga" UNIQUE ("vaga_id", "candidato_id");



ALTER TABLE ONLY "public"."rs_credenciais"
    ADD CONSTRAINT "rs_credenciais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_credenciais"
    ADD CONSTRAINT "rs_credenciais_valor_hash_key" UNIQUE ("valor_hash");



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_empresas"
    ADD CONSTRAINT "rs_empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_empresas"
    ADD CONSTRAINT "rs_empresas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."rs_entregas_webhook"
    ADD CONSTRAINT "rs_entregas_unica" UNIQUE ("webhook_id", "evento_id");



ALTER TABLE ONLY "public"."rs_entregas_webhook"
    ADD CONSTRAINT "rs_entregas_webhook_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_etapas"
    ADD CONSTRAINT "rs_etapas_ordem_unica" UNIQUE ("vaga_id", "ordem") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."rs_etapas"
    ADD CONSTRAINT "rs_etapas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_eventos"
    ADD CONSTRAINT "rs_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_membro_areas"
    ADD CONSTRAINT "rs_membro_areas_pkey" PRIMARY KEY ("membro_id", "area_id");



ALTER TABLE ONLY "public"."rs_membros"
    ADD CONSTRAINT "rs_membros_convite_token_hash_key" UNIQUE ("convite_token_hash");



ALTER TABLE ONLY "public"."rs_membros"
    ADD CONSTRAINT "rs_membros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_modelos_mensagem"
    ADD CONSTRAINT "rs_modelos_chave_unica" UNIQUE ("empresa_id", "chave");



ALTER TABLE ONLY "public"."rs_modelos_mensagem"
    ADD CONSTRAINT "rs_modelos_mensagem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_notas"
    ADD CONSTRAINT "rs_notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_notificacoes"
    ADD CONSTRAINT "rs_notificacoes_chave_idempotencia_key" UNIQUE ("chave_idempotencia");



ALTER TABLE ONLY "public"."rs_notificacoes"
    ADD CONSTRAINT "rs_notificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_oauth_clientes"
    ADD CONSTRAINT "rs_oauth_clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_oauth_codigos"
    ADD CONSTRAINT "rs_oauth_codigos_pkey" PRIMARY KEY ("codigo_hash");



ALTER TABLE ONLY "public"."rs_perguntas"
    ADD CONSTRAINT "rs_perguntas_ordem_unica" UNIQUE ("vaga_id", "ordem") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."rs_perguntas"
    ADD CONSTRAINT "rs_perguntas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_pessoas"
    ADD CONSTRAINT "rs_pessoas_membro_id_key" UNIQUE ("membro_id");



ALTER TABLE ONLY "public"."rs_pessoas"
    ADD CONSTRAINT "rs_pessoas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_respostas"
    ADD CONSTRAINT "rs_respostas_pkey" PRIMARY KEY ("candidatura_id", "pergunta_id");



ALTER TABLE ONLY "public"."rs_usuarios"
    ADD CONSTRAINT "rs_usuarios_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."rs_usuarios"
    ADD CONSTRAINT "rs_usuarios_google_sub_key" UNIQUE ("google_sub");



ALTER TABLE ONLY "public"."rs_usuarios"
    ADD CONSTRAINT "rs_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_vaga_equipe"
    ADD CONSTRAINT "rs_vaga_equipe_pkey" PRIMARY KEY ("vaga_id", "membro_id");



ALTER TABLE ONLY "public"."rs_vagas"
    ADD CONSTRAINT "rs_vagas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rs_vagas"
    ADD CONSTRAINT "rs_vagas_slug_unico" UNIQUE ("empresa_id", "slug");



ALTER TABLE ONLY "public"."rs_webhooks"
    ADD CONSTRAINT "rs_webhooks_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "rs_areas_nome_ativa" ON "public"."rs_areas" USING "btree" ("empresa_id", "lower"("nome")) WHERE ("arquivada_em" IS NULL);



CREATE INDEX "rs_areas_responsavel" ON "public"."rs_areas" USING "btree" ("responsavel_pessoa_id");



CREATE INDEX "rs_arquivos_empresa" ON "public"."rs_arquivos" USING "btree" ("empresa_id");



CREATE INDEX "rs_arquivos_nao_confirmados" ON "public"."rs_arquivos" USING "btree" ("criado_em") WHERE ("confirmado_em" IS NULL);



CREATE UNIQUE INDEX "rs_arquivos_um_curriculo" ON "public"."rs_arquivos" USING "btree" ("candidatura_id") WHERE ("tipo" = 'curriculo'::"public"."rs_tipo_arquivo");



CREATE INDEX "rs_avaliacoes_etapa" ON "public"."rs_avaliacoes" USING "btree" ("etapa_id");



CREATE INDEX "rs_avaliacoes_membro" ON "public"."rs_avaliacoes" USING "btree" ("membro_id");



CREATE INDEX "rs_candidatos_talentos" ON "public"."rs_candidatos" USING "btree" ("empresa_id", "talentos_expira_em") WHERE ("talentos_expira_em" IS NOT NULL);



CREATE INDEX "rs_candidaturas_busca" ON "public"."rs_candidaturas" USING "gin" ("texto_busca");



CREATE INDEX "rs_candidaturas_candidato" ON "public"."rs_candidaturas" USING "btree" ("candidato_id");



CREATE INDEX "rs_candidaturas_etapa" ON "public"."rs_candidaturas" USING "btree" ("etapa_id");



CREATE INDEX "rs_candidaturas_expurgo" ON "public"."rs_candidaturas" USING "btree" ("expurgar_em") WHERE ("expurgar_em" IS NOT NULL);



CREATE INDEX "rs_candidaturas_funil" ON "public"."rs_candidaturas" USING "btree" ("empresa_id", "vaga_id", "situacao", "etapa_id");



CREATE INDEX "rs_candidaturas_paradas" ON "public"."rs_candidaturas" USING "btree" ("empresa_id", "movida_em") WHERE ("situacao" = 'ativa'::"public"."rs_situacao_candidatura");



CREATE INDEX "rs_credenciais_cliente" ON "public"."rs_credenciais" USING "btree" ("oauth_cliente_id");



CREATE INDEX "rs_credenciais_criada_por" ON "public"."rs_credenciais" USING "btree" ("criada_por_membro_id");



CREATE INDEX "rs_credenciais_empresa" ON "public"."rs_credenciais" USING "btree" ("empresa_id") WHERE ("revogada_em" IS NULL);



CREATE INDEX "rs_credenciais_membro" ON "public"."rs_credenciais" USING "btree" ("membro_id") WHERE ("revogada_em" IS NULL);



CREATE INDEX "rs_decisoes_credencial" ON "public"."rs_decisoes" USING "btree" ("credencial_id");



CREATE INDEX "rs_decisoes_decidida_por" ON "public"."rs_decisoes" USING "btree" ("decidida_por_membro_id");



CREATE INDEX "rs_decisoes_empresa_status" ON "public"."rs_decisoes" USING "btree" ("empresa_id", "status");



CREATE UNIQUE INDEX "rs_decisoes_pendente_candidatura" ON "public"."rs_decisoes" USING "btree" ("tipo", "candidatura_id") WHERE (("status" = 'pendente'::"public"."rs_status_decisao") AND ("candidatura_id" IS NOT NULL));



CREATE UNIQUE INDEX "rs_decisoes_pendente_vaga" ON "public"."rs_decisoes" USING "btree" ("tipo", "vaga_id") WHERE (("status" = 'pendente'::"public"."rs_status_decisao") AND ("vaga_id" IS NOT NULL));



CREATE INDEX "rs_decisoes_proposta_por" ON "public"."rs_decisoes" USING "btree" ("proposta_por_membro_id");



CREATE INDEX "rs_decisoes_vaga" ON "public"."rs_decisoes" USING "btree" ("vaga_id");



CREATE INDEX "rs_entregas_empresa" ON "public"."rs_entregas_webhook" USING "btree" ("empresa_id");



CREATE INDEX "rs_entregas_evento" ON "public"."rs_entregas_webhook" USING "btree" ("evento_id");



CREATE INDEX "rs_entregas_fila" ON "public"."rs_entregas_webhook" USING "btree" ("status", "proxima_tentativa_em") WHERE ("status" = ANY (ARRAY['pendente'::"public"."rs_status_entrega", 'falhou'::"public"."rs_status_entrega"]));



CREATE INDEX "rs_eventos_candidatura" ON "public"."rs_eventos" USING "btree" ("empresa_id", "candidatura_id", "id");



CREATE INDEX "rs_eventos_empresa" ON "public"."rs_eventos" USING "btree" ("empresa_id", "id");



CREATE INDEX "rs_membro_areas_area" ON "public"."rs_membro_areas" USING "btree" ("area_id");



CREATE INDEX "rs_membros_convidado_por" ON "public"."rs_membros" USING "btree" ("convidado_por_membro_id");



CREATE UNIQUE INDEX "rs_membros_email_ativo" ON "public"."rs_membros" USING "btree" ("empresa_id", "email") WHERE ("removido_em" IS NULL);



CREATE INDEX "rs_membros_usuario" ON "public"."rs_membros" USING "btree" ("usuario_id") WHERE ("removido_em" IS NULL);



CREATE UNIQUE INDEX "rs_membros_usuario_ativo" ON "public"."rs_membros" USING "btree" ("empresa_id", "usuario_id") WHERE (("removido_em" IS NULL) AND ("usuario_id" IS NOT NULL));



CREATE INDEX "rs_mensagens_candidatura" ON "public"."rs_mensagens" USING "btree" ("candidatura_id");



CREATE INDEX "rs_mensagens_credencial" ON "public"."rs_mensagens" USING "btree" ("credencial_id");



CREATE INDEX "rs_mensagens_decisao" ON "public"."rs_mensagens" USING "btree" ("decisao_id");



CREATE INDEX "rs_mensagens_empresa" ON "public"."rs_mensagens" USING "btree" ("empresa_id");



CREATE INDEX "rs_mensagens_membro" ON "public"."rs_mensagens" USING "btree" ("membro_id");



CREATE INDEX "rs_mensagens_notificacao" ON "public"."rs_mensagens" USING "btree" ("notificacao_id");



CREATE INDEX "rs_notas_candidatura" ON "public"."rs_notas" USING "btree" ("candidatura_id");



CREATE INDEX "rs_notas_credencial" ON "public"."rs_notas" USING "btree" ("credencial_id");



CREATE INDEX "rs_notas_membro" ON "public"."rs_notas" USING "btree" ("membro_id");



CREATE INDEX "rs_notificacoes_candidatura" ON "public"."rs_notificacoes" USING "btree" ("candidatura_id");



CREATE INDEX "rs_notificacoes_empresa" ON "public"."rs_notificacoes" USING "btree" ("empresa_id", "criado_em");



CREATE INDEX "rs_notificacoes_fila" ON "public"."rs_notificacoes" USING "btree" ("status", "enviar_apos") WHERE ("status" = ANY (ARRAY['pendente'::"public"."rs_status_notificacao", 'falhou'::"public"."rs_status_notificacao"]));



CREATE INDEX "rs_oauth_codigos_cliente" ON "public"."rs_oauth_codigos" USING "btree" ("cliente_id");



CREATE INDEX "rs_oauth_codigos_credencial" ON "public"."rs_oauth_codigos" USING "btree" ("credencial_id");



CREATE INDEX "rs_oauth_codigos_empresa" ON "public"."rs_oauth_codigos" USING "btree" ("empresa_id");



CREATE INDEX "rs_oauth_codigos_expira" ON "public"."rs_oauth_codigos" USING "btree" ("expira_em");



CREATE INDEX "rs_oauth_codigos_membro" ON "public"."rs_oauth_codigos" USING "btree" ("membro_id");



CREATE INDEX "rs_pessoas_area" ON "public"."rs_pessoas" USING "btree" ("area_id");



CREATE UNIQUE INDEX "rs_pessoas_email_ativa" ON "public"."rs_pessoas" USING "btree" ("empresa_id", "email") WHERE ("arquivada_em" IS NULL);



CREATE INDEX "rs_respostas_pergunta" ON "public"."rs_respostas" USING "btree" ("pergunta_id");



CREATE INDEX "rs_vaga_equipe_membro" ON "public"."rs_vaga_equipe" USING "btree" ("membro_id");



CREATE UNIQUE INDEX "rs_vaga_equipe_um_responsavel" ON "public"."rs_vaga_equipe" USING "btree" ("vaga_id") WHERE ("papel_na_vaga" = 'responsavel'::"public"."rs_papel_na_vaga");



CREATE INDEX "rs_vagas_area" ON "public"."rs_vagas" USING "btree" ("area_id");



CREATE INDEX "rs_vagas_dono" ON "public"."rs_vagas" USING "btree" ("dono_pessoa_id");



CREATE INDEX "rs_vagas_empresa_status" ON "public"."rs_vagas" USING "btree" ("empresa_id", "status");



CREATE INDEX "rs_webhooks_empresa" ON "public"."rs_webhooks" USING "btree" ("empresa_id");



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_areas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_avaliacoes" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_candidatos" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_empresas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_modelos_mensagem" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_vagas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_etapa_da_vaga" BEFORE INSERT OR UPDATE OF "etapa_id", "vaga_id", "empresa_id", "candidato_id" ON "public"."rs_candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_etapa_da_vaga"();



CREATE OR REPLACE TRIGGER "rs_tg_eventos_imutaveis" BEFORE DELETE OR UPDATE ON "public"."rs_eventos" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_eventos_imutaveis"();



CREATE OR REPLACE TRIGGER "rs_tg_situacao_candidatura" BEFORE INSERT OR UPDATE ON "public"."rs_candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_situacao_candidatura"();



CREATE OR REPLACE TRIGGER "rs_tg_vaga_congelada" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rs_perguntas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_vaga_congelada"();



CREATE OR REPLACE TRIGGER "rs_tg_vaga_congelada" BEFORE DELETE OR UPDATE ON "public"."rs_vagas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_vaga_congelada"();



ALTER TABLE ONLY "public"."rs_areas"
    ADD CONSTRAINT "rs_areas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_areas"
    ADD CONSTRAINT "rs_areas_responsavel_fk" FOREIGN KEY ("responsavel_pessoa_id") REFERENCES "public"."rs_pessoas"("id");



ALTER TABLE ONLY "public"."rs_arquivos"
    ADD CONSTRAINT "rs_arquivos_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_arquivos"
    ADD CONSTRAINT "rs_arquivos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_avaliacoes"
    ADD CONSTRAINT "rs_avaliacoes_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_avaliacoes"
    ADD CONSTRAINT "rs_avaliacoes_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "public"."rs_etapas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_avaliacoes"
    ADD CONSTRAINT "rs_avaliacoes_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_candidatos"
    ADD CONSTRAINT "rs_candidatos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "public"."rs_candidatos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "public"."rs_etapas"("id");



ALTER TABLE ONLY "public"."rs_candidaturas"
    ADD CONSTRAINT "rs_candidaturas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "public"."rs_vagas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_credenciais"
    ADD CONSTRAINT "rs_credenciais_criada_por_membro_id_fkey" FOREIGN KEY ("criada_por_membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_credenciais"
    ADD CONSTRAINT "rs_credenciais_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_credenciais"
    ADD CONSTRAINT "rs_credenciais_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_credenciais"
    ADD CONSTRAINT "rs_credenciais_oauth_cliente_id_fkey" FOREIGN KEY ("oauth_cliente_id") REFERENCES "public"."rs_oauth_clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_credencial_id_fkey" FOREIGN KEY ("credencial_id") REFERENCES "public"."rs_credenciais"("id");



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_decidida_por_membro_id_fkey" FOREIGN KEY ("decidida_por_membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_proposta_por_membro_id_fkey" FOREIGN KEY ("proposta_por_membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_decisoes"
    ADD CONSTRAINT "rs_decisoes_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "public"."rs_vagas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_empresas"
    ADD CONSTRAINT "rs_empresas_criada_por_usuario_id_fkey" FOREIGN KEY ("criada_por_usuario_id") REFERENCES "public"."rs_usuarios"("id");



ALTER TABLE ONLY "public"."rs_entregas_webhook"
    ADD CONSTRAINT "rs_entregas_webhook_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_entregas_webhook"
    ADD CONSTRAINT "rs_entregas_webhook_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."rs_eventos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_entregas_webhook"
    ADD CONSTRAINT "rs_entregas_webhook_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."rs_webhooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_etapas"
    ADD CONSTRAINT "rs_etapas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "public"."rs_vagas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_eventos"
    ADD CONSTRAINT "rs_eventos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_membro_areas"
    ADD CONSTRAINT "rs_membro_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."rs_areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_membro_areas"
    ADD CONSTRAINT "rs_membro_areas_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_membros"
    ADD CONSTRAINT "rs_membros_convidado_por_membro_id_fkey" FOREIGN KEY ("convidado_por_membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_membros"
    ADD CONSTRAINT "rs_membros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_membros"
    ADD CONSTRAINT "rs_membros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."rs_usuarios"("id");



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_credencial_id_fkey" FOREIGN KEY ("credencial_id") REFERENCES "public"."rs_credenciais"("id");



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_decisao_id_fkey" FOREIGN KEY ("decisao_id") REFERENCES "public"."rs_decisoes"("id");



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_mensagens"
    ADD CONSTRAINT "rs_mensagens_notificacao_id_fkey" FOREIGN KEY ("notificacao_id") REFERENCES "public"."rs_notificacoes"("id");



ALTER TABLE ONLY "public"."rs_modelos_mensagem"
    ADD CONSTRAINT "rs_modelos_mensagem_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_notas"
    ADD CONSTRAINT "rs_notas_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_notas"
    ADD CONSTRAINT "rs_notas_credencial_id_fkey" FOREIGN KEY ("credencial_id") REFERENCES "public"."rs_credenciais"("id");



ALTER TABLE ONLY "public"."rs_notas"
    ADD CONSTRAINT "rs_notas_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_notificacoes"
    ADD CONSTRAINT "rs_notificacoes_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rs_notificacoes"
    ADD CONSTRAINT "rs_notificacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_oauth_codigos"
    ADD CONSTRAINT "rs_oauth_codigos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."rs_oauth_clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_oauth_codigos"
    ADD CONSTRAINT "rs_oauth_codigos_credencial_id_fkey" FOREIGN KEY ("credencial_id") REFERENCES "public"."rs_credenciais"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rs_oauth_codigos"
    ADD CONSTRAINT "rs_oauth_codigos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_oauth_codigos"
    ADD CONSTRAINT "rs_oauth_codigos_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_perguntas"
    ADD CONSTRAINT "rs_perguntas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "public"."rs_vagas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_pessoas"
    ADD CONSTRAINT "rs_pessoas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."rs_areas"("id");



ALTER TABLE ONLY "public"."rs_pessoas"
    ADD CONSTRAINT "rs_pessoas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_pessoas"
    ADD CONSTRAINT "rs_pessoas_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_respostas"
    ADD CONSTRAINT "rs_respostas_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "public"."rs_candidaturas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_respostas"
    ADD CONSTRAINT "rs_respostas_pergunta_id_fkey" FOREIGN KEY ("pergunta_id") REFERENCES "public"."rs_perguntas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_vaga_equipe"
    ADD CONSTRAINT "rs_vaga_equipe_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_vaga_equipe"
    ADD CONSTRAINT "rs_vaga_equipe_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "public"."rs_vagas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_vagas"
    ADD CONSTRAINT "rs_vagas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."rs_areas"("id");



ALTER TABLE ONLY "public"."rs_vagas"
    ADD CONSTRAINT "rs_vagas_dono_pessoa_id_fkey" FOREIGN KEY ("dono_pessoa_id") REFERENCES "public"."rs_pessoas"("id");



ALTER TABLE ONLY "public"."rs_vagas"
    ADD CONSTRAINT "rs_vagas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_webhooks"
    ADD CONSTRAINT "rs_webhooks_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE "public"."rs_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_arquivos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_avaliacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_candidatos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_candidaturas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_credenciais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_decisoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_empresas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_entregas_webhook" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_etapas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_eventos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_membro_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_membros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_mensagens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_modelos_mensagem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_notas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_notificacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_oauth_clientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_oauth_codigos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_perguntas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_pessoas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_respostas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_usuarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_vaga_equipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_vagas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rs_webhooks" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_aceita_convite"("p_membro" "uuid", "p_usuario" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_aceita_convite"("p_membro" "uuid", "p_usuario" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_arquiva_area"("p_area" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_arquiva_area"("p_area" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_arquiva_pessoa"("p_pessoa" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_arquiva_pessoa"("p_pessoa" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cancela_convite"("p_membro" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cancela_convite"("p_membro" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_convida_membro"("p_empresa" "uuid", "p_email" "text", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_convida_membro"("p_empresa" "uuid", "p_email" "text", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_chave_api"("p_empresa" "uuid", "p_nome" "text", "p_prefixo" "text", "p_valor_hash" "text", "p_escopos" "public"."rs_escopo"[], "p_max_ativas" integer, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_chave_api"("p_empresa" "uuid", "p_nome" "text", "p_prefixo" "text", "p_valor_hash" "text", "p_escopos" "public"."rs_escopo"[], "p_max_ativas" integer, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_empresa" "uuid", "p_membro" "uuid", "p_escopos" "public"."rs_escopo"[], "p_redirect_uri" "text", "p_code_challenge" "text", "p_validade_s" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_empresa" "uuid", "p_membro" "uuid", "p_escopos" "public"."rs_escopo"[], "p_redirect_uri" "text", "p_code_challenge" "text", "p_validade_s" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_empresa"("p_usuario" "uuid", "p_slug" "text", "p_nome" "text", "p_email_contato" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_empresa"("p_usuario" "uuid", "p_slug" "text", "p_nome" "text", "p_email_contato" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_da_acesso"("p_pessoa" "uuid", "p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_da_acesso"("p_pessoa" "uuid", "p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_entra_usuario"("p_google_sub" "text", "p_email" "text", "p_nome" "text", "p_foto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_entra_usuario"("p_google_sub" "text", "p_email" "text", "p_nome" "text", "p_foto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_expurga_empresa"("p_empresa" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_expurga_empresa"("p_empresa" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_garante_administrador"("p_membro" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_garante_administrador"("p_membro" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_muda_acesso"("p_membro" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_muda_acesso"("p_membro" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_reenvia_convite"("p_membro" "uuid", "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_reenvia_convite"("p_membro" "uuid", "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_registra_evento"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidatura" "uuid", "p_tipo" "text", "p_ator" "jsonb", "p_origem" "public"."rs_origem_evento", "p_dados" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_registra_evento"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidatura" "uuid", "p_tipo" "text", "p_ator" "jsonb", "p_origem" "public"."rs_origem_evento", "p_dados" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_remove_membro"("p_membro" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_remove_membro"("p_membro" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_revoga_credencial"("p_credencial" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_revoga_credencial"("p_credencial" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_salva_area"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_responsavel" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_salva_area"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_responsavel" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_salva_pessoa"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_email" "text", "p_cargo" "text", "p_area" "uuid", "p_recebe_resumo" boolean, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_salva_pessoa"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_email" "text", "p_cargo" "text", "p_area" "uuid", "p_recebe_resumo" boolean, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_troca_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_redirect_uri" "text", "p_challenge_do_verifier" "text", "p_token_hash" "text", "p_token_prefixo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_troca_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_redirect_uri" "text", "p_challenge_do_verifier" "text", "p_token_hash" "text", "p_token_prefixo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_valida_areas"("p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas" boolean, "p_areas" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_valida_areas"("p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas" boolean, "p_areas" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_tg_atualizado_em"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_tg_atualizado_em"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_tg_etapa_da_vaga"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_tg_etapa_da_vaga"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_tg_eventos_imutaveis"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_tg_eventos_imutaveis"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_tg_situacao_candidatura"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_tg_situacao_candidatura"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_tg_vaga_congelada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_tg_vaga_congelada"() TO "service_role";



GRANT ALL ON TABLE "public"."rs_areas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_arquivos" TO "service_role";



GRANT ALL ON TABLE "public"."rs_avaliacoes" TO "service_role";



GRANT ALL ON TABLE "public"."rs_candidatos" TO "service_role";



GRANT ALL ON TABLE "public"."rs_candidaturas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_credenciais" TO "service_role";



GRANT ALL ON TABLE "public"."rs_decisoes" TO "service_role";



GRANT ALL ON TABLE "public"."rs_empresas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_entregas_webhook" TO "service_role";



GRANT ALL ON TABLE "public"."rs_etapas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_eventos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rs_eventos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rs_membro_areas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_membros" TO "service_role";



GRANT ALL ON TABLE "public"."rs_mensagens" TO "service_role";



GRANT ALL ON TABLE "public"."rs_modelos_mensagem" TO "service_role";



GRANT ALL ON TABLE "public"."rs_notas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_notificacoes" TO "service_role";



GRANT ALL ON TABLE "public"."rs_oauth_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."rs_oauth_codigos" TO "service_role";



GRANT ALL ON TABLE "public"."rs_perguntas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_pessoas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_respostas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."rs_vaga_equipe" TO "service_role";



GRANT ALL ON TABLE "public"."rs_vagas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_webhooks" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







