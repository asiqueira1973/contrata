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


CREATE OR REPLACE FUNCTION "public"."rs_fn_adiciona_nota"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_texto" "text", "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
  v_id uuid;
  v_texto text := pg_catalog.btrim(coalesce(p_texto, ''));
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(v_texto) not between 1 and 10000 then
    raise exception 'nota_invalida' using errcode = 'P0001';
  end if;
  if p_ator ->> 'tipo' not in ('membro', 'agente', 'api') then
    raise exception 'ator_invalido' using errcode = 'P0001';
  end if;
  insert into public.rs_notas (candidatura_id, texto, ator_tipo, membro_id, credencial_id)
  values (p_candidatura, v_texto, (p_ator ->> 'tipo')::public.rs_tipo_ator, (p_ator ->> 'membro_id')::uuid,
          (p_ator ->> 'credencial_id')::uuid)
  returning id into v_id;
  update public.rs_candidaturas set atualizado_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'nota_adicionada', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'nota_id', v_id));
  return v_id;
end $$;


ALTER FUNCTION "public"."rs_fn_adiciona_nota"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_texto" "text", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_alvo_da_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
begin
  if p_tipo = 'encerrar_vaga' then
    select * into v_vaga from public.rs_vagas where id = p_vaga and empresa_id = p_empresa;
    if v_vaga.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then return 'nao_encontrado'; end if;
    if v_vaga.status = 'encerrada' then return 'vaga_encerrada'; end if;
    return null;
  end if;
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then return 'nao_encontrado'; end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then return 'candidatura_encerrada'; end if;
  if p_tipo <> 'enviar_mensagem' and v.situacao <> 'ativa' then return 'candidatura_encerrada'; end if;
  return null;
end $$;


ALTER FUNCTION "public"."rs_fn_alvo_da_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_anonimiza_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_paths text[];
  v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.array_agg(path), '{}') into v_paths from public.rs_arquivos where candidatura_id = p_candidatura;
  delete from public.rs_arquivos where candidatura_id = p_candidatura;
  delete from public.rs_respostas where candidatura_id = p_candidatura;
  delete from public.rs_notas where candidatura_id = p_candidatura;
  update public.rs_avaliacoes set comentario = '' where candidatura_id = p_candidatura;
  update public.rs_mensagens set assunto = '', corpo = '' where candidatura_id = p_candidatura;
  update public.rs_notificacoes set status = 'descartada', html = '', texto = ''
   where candidatura_id = p_candidatura and status in ('pendente', 'falhou');
  update public.rs_candidaturas set texto_busca = null, sinalizada = false, exclusao_codigo_hash = null, revisao_texto = null,
         token_hash = 'anonimizada:' || id::text
   where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_anonimizada',
    pg_catalog.jsonb_build_object('tipo', 'sistema'), 'publico', pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  return v_paths;
end $$;


ALTER FUNCTION "public"."rs_fn_anonimiza_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_area_no_alcance"("p_area" "uuid", "p_alcance" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
begin
  case p_alcance ->> 'tipo'
    when 'todas' then return true;
    when 'areas' then
      return p_area is not null and p_area::text in (select pg_catalog.jsonb_array_elements_text(p_alcance -> 'area_ids'));
    else return false;
  end case;
end $$;


ALTER FUNCTION "public"."rs_fn_area_no_alcance"("p_area" "uuid", "p_alcance" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_atualiza_busca"("p_candidatura" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.rs_candidaturas c set texto_busca = pg_catalog.to_tsvector('pg_catalog.portuguese', extensions.unaccent(
    coalesce(k.nome, '') || ' ' || coalesce(k.email::text, '') || ' ' || coalesce(k.cidade, '') || ' ' ||
    coalesce((select pg_catalog.string_agg(r.valor, ' ') from public.rs_respostas r where r.candidatura_id = c.id), '') || ' ' ||
    coalesce((select a.texto_extraido from public.rs_arquivos a where a.candidatura_id = c.id and a.tipo = 'curriculo'), '')))
    from public.rs_candidatos k
   where c.id = p_candidatura and k.id = c.candidato_id;
end $$;


ALTER FUNCTION "public"."rs_fn_atualiza_busca"("p_candidatura" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_busca_talentos"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) RETURNS TABLE("candidato_id" "uuid", "nome" "text", "cidade" "text", "linkedin_url" "text", "talentos_expira_em" timestamp with time zone, "relevancia" real)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
declare
  v_q text := nullif(pg_catalog.btrim(p_filtros ->> 'q'), '');
  v_tsq tsquery := case when v_q is null then null
                        else pg_catalog.websearch_to_tsquery('pg_catalog.portuguese', extensions.unaccent(v_q)) end;
  v_vaga uuid := nullif(p_filtros ->> 'vaga_anterior', '')::uuid;
begin
  if v_q is not null and pg_catalog.strpos(v_q, '@') > 0 then
    return;
  end if;
  return query
  with visiveis as (
    select c.candidato_id, c.vaga_id, c.texto_busca
      from public.rs_candidaturas c join public.rs_vagas v on v.id = c.vaga_id
     where c.empresa_id = p_empresa and c.recebida_em is not null and p_alcance ->> 'tipo' <> 'equipe'
       and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance)
  )
  select k.id, k.nome, k.cidade, k.linkedin_url, k.talentos_expira_em,
         case when v_tsq is null then null else
           (select max(pg_catalog.ts_rank(c.texto_busca, v_tsq)) from visiveis c where c.candidato_id = k.id and c.texto_busca @@ v_tsq) end
    from public.rs_candidatos k
   where k.empresa_id = p_empresa
     and k.anonimizado_em is null
     and k.talentos_expira_em > pg_catalog.now()
     and exists (select 1 from visiveis c where c.candidato_id = k.id)
     and (v_vaga is null or exists (select 1 from visiveis c where c.candidato_id = k.id and c.vaga_id = v_vaga))
     and (v_tsq is null or exists (select 1 from visiveis c where c.candidato_id = k.id and c.texto_busca @@ v_tsq))
   order by 6 desc nulls last, k.talentos_expira_em desc, k.id
   offset greatest(p_inicio, 0) limit greatest(p_limite, 0);
end $$;


ALTER FUNCTION "public"."rs_fn_busca_talentos"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_conclui_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_arquivo" "jsonb", "p_mensagem" "jsonb", "p_notificacao" "jsonb", "p_ator" "jsonb", "p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_obrigatorio boolean;
  v_arquivo uuid;
  v_notificacao uuid;
  v_vaga public.rs_vagas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.recebida_em is not null then
    return pg_catalog.jsonb_build_object('ja_recebida', true);
  end if;
  -- A vaga pode ter saído do ar entre criar e concluir (até 1 h): não entra candidatura ativa em
  -- vaga pausada ou encerrada (12.1, 11.5; achado do verifier do 8.4).
  select * into v_vaga from public.rs_vagas where id = v.vaga_id for share;
  if v_vaga.status <> 'publicada' then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  v_obrigatorio := v_vaga.curriculo_obrigatorio;
  if v_obrigatorio and p_arquivo is null and v.origem <> 'manual' then
    raise exception 'curriculo_obrigatorio' using errcode = 'P0001';
  end if;
  if p_arquivo is not null then
    delete from public.rs_arquivos where candidatura_id = p_candidatura and tipo = 'curriculo';
    insert into public.rs_arquivos (empresa_id, candidatura_id, tipo, path, nome_original, mime, bytes, sha256, confirmado_em)
    values (p_empresa, p_candidatura, 'curriculo', p_arquivo ->> 'path', p_arquivo ->> 'nome_original', p_arquivo ->> 'mime',
            (p_arquivo ->> 'bytes')::integer, p_arquivo ->> 'sha256', pg_catalog.now())
    returning id into v_arquivo;
  end if;
  update public.rs_candidaturas set recebida_em = pg_catalog.now(), movida_em = pg_catalog.now(), token_hash = p_token_hash
   where id = p_candidatura;
  insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
  values (p_empresa, p_candidatura, (p_notificacao ->> 'tipo')::public.rs_tipo_notificacao, p_notificacao ->> 'destinatario',
          p_notificacao ->> 'chave', p_notificacao ->> 'assunto', p_notificacao ->> 'html', p_notificacao ->> 'texto',
          nullif(p_notificacao ->> 'reply_to', ''))
  returning id into v_notificacao;
  insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, notificacao_id)
  values (p_empresa, p_candidatura, 'confirmacao', p_mensagem ->> 'assunto', p_mensagem ->> 'corpo', 'sistema', v_notificacao);
  -- Banco de talentos (11.29): o pedido feito no formulário só vira consentimento aqui, com a
  -- candidatura enviada; a abandonada não deixa a pessoa no banco.
  if v.talentos_pedido then
    update public.rs_candidatos set talentos_consentido_em = pg_catalog.now(),
           talentos_expira_em = pg_catalog.now() + pg_catalog.make_interval(months => e.talentos_meses)
      from public.rs_empresas e
     where rs_candidatos.id = v.candidato_id and e.id = p_empresa;
    perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'talentos_consentido', p_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  end if;
  perform public.rs_fn_atualiza_busca(p_candidatura);
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_criada', p_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'origem', v.origem, 'com_curriculo', p_arquivo is not null,
      'sinalizada', v.sinalizada));
  return pg_catalog.jsonb_build_object('notificacao_id', v_notificacao, 'arquivo_id', v_arquivo);
end $$;


ALTER FUNCTION "public"."rs_fn_conclui_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_arquivo" "jsonb", "p_mensagem" "jsonb", "p_notificacao" "jsonb", "p_ator" "jsonb", "p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_confere_vaga"("p_empresa" "uuid", "p_area" "uuid", "p_dono" "uuid", "p_alcance" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if p_area is not null and not exists (
    select 1 from public.rs_areas where id = p_area and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
  if not public.rs_fn_area_no_alcance(p_area, p_alcance) then
    raise exception 'fora_do_alcance' using errcode = 'P0001';
  end if;
  if p_dono is not null and not exists (
    select 1 from public.rs_pessoas where id = p_dono and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_confere_vaga"("p_empresa" "uuid", "p_area" "uuid", "p_dono" "uuid", "p_alcance" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_confirma_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  d public.rs_decisoes;
  v_motivo text;
  v_ator jsonb;
begin
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  select * into d from public.rs_decisoes where id = p_decisao and empresa_id = p_empresa for update;
  -- Alcance antes de tudo: fora dele a proposta não existe para quem clica.
  if d.id is null or public.rs_fn_alvo_da_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, p_alcance) = 'nao_encontrado' then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if d.status <> 'pendente' then
    return pg_catalog.jsonb_build_object('status', d.status, 'motivo', 'ja_decidida');
  end if;
  v_motivo := case when d.expira_em <= pg_catalog.now() then 'venceu'
                   else public.rs_fn_alvo_da_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, p_alcance) end;
  if v_motivo = 'nao_encontrado' then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v_motivo is not null then
    update public.rs_decisoes set status = 'expirada', decidida_por_membro_id = (p_ator ->> 'membro_id')::uuid, decidida_em = pg_catalog.now()
     where id = d.id;
    perform public.rs_fn_registra_evento(p_empresa, d.vaga_id, d.candidatura_id, 'decisao_expirada', p_ator, 'web',
      pg_catalog.jsonb_build_object('decisao_id', d.id, 'motivo', v_motivo));
    return pg_catalog.jsonb_build_object('status', 'expirada', 'motivo', v_motivo);
  end if;
  -- Quem executa é o membro que clicou; o evento guarda quem propôs.
  v_ator := p_ator || pg_catalog.jsonb_build_object('autorizado_por_membro_id', p_ator ->> 'membro_id');
  perform public.rs_fn_executa_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, coalesce(p_payload, d.payload), p_mensagens, v_ator, d.id);
  update public.rs_decisoes set status = 'confirmada', payload = coalesce(p_payload, d.payload),
         decidida_por_membro_id = (p_ator ->> 'membro_id')::uuid, decidida_em = pg_catalog.now()
   where id = d.id;
  perform public.rs_fn_registra_evento(p_empresa, d.vaga_id, d.candidatura_id, 'decisao_confirmada', v_ator, 'web',
    pg_catalog.jsonb_build_object('decisao_id', d.id, 'tipo', d.tipo, 'proposta_por_tipo', d.proposta_por_tipo,
      'proposta_por_membro_id', d.proposta_por_membro_id, 'proposta_por_credencial_id', d.credencial_id));
  return pg_catalog.jsonb_build_object('status', 'confirmada');
end $$;


ALTER FUNCTION "public"."rs_fn_confirma_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_conta_tentativa"("p_chave" "text", "p_tipo" "text", "p_limite" integer, "p_janela_s" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_tipo || ':' || p_chave));
  if (select count(*) from public.rs_tentativas_publicas
      where tipo = p_tipo and chave_hash = p_chave
        and criado_em > pg_catalog.now() - pg_catalog.make_interval(secs => p_janela_s)) >= p_limite then
    return false;
  end if;
  insert into public.rs_tentativas_publicas (chave_hash, tipo) values (p_chave, p_tipo);
  return true;
end $$;


ALTER FUNCTION "public"."rs_fn_conta_tentativa"("p_chave" "text", "p_tipo" "text", "p_limite" integer, "p_janela_s" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_convida_talento"("p_empresa" "uuid", "p_candidato" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_vaga public.rs_vagas;
  k public.rs_candidatos;
  v_id uuid;
begin
  if p_ator ->> 'tipo' not in ('membro', 'agente', 'api') then
    raise exception 'ator_invalido' using errcode = 'P0001';
  end if;
  select * into v_vaga from public.rs_vagas where id = p_vaga and empresa_id = p_empresa;
  if v_vaga.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'vaga_nao_encontrada' using errcode = 'P0001';
  end if;
  if v_vaga.status <> 'publicada' then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  select * into k from public.rs_candidatos where id = p_candidato and empresa_id = p_empresa for update;
  if k.id is null or k.anonimizado_em is not null or k.talentos_expira_em is null or k.talentos_expira_em <= pg_catalog.now()
     or not public.rs_fn_talento_no_alcance(k.id, p_alcance) then
    raise exception 'talento_indisponivel' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidaturas where candidato_id = k.id and vaga_id = p_vaga) then
    return pg_catalog.jsonb_build_object('convite_id', null, 'ja_candidato', true);
  end if;
  select id into v_id from public.rs_convites_talento where candidato_id = k.id and vaga_id = p_vaga and usado_em is null
     and expira_em > pg_catalog.now() order by criado_em desc limit 1;
  if v_id is null then
    insert into public.rs_convites_talento (empresa_id, candidato_id, vaga_id, ator_tipo, membro_id, credencial_id)
    values (p_empresa, k.id, p_vaga, (p_ator ->> 'tipo')::public.rs_tipo_ator, (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid)
    returning id into v_id;
  end if;
  perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'talentos_convidado', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidato_id', k.id, 'vaga_id', p_vaga, 'convite_id', v_id));
  return pg_catalog.jsonb_build_object('convite_id', v_id, 'ja_candidato', false);
end $$;


ALTER FUNCTION "public"."rs_fn_convida_talento"("p_empresa" "uuid", "p_candidato" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_cria_candidatura"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidato" "jsonb", "p_respostas" "jsonb", "p_origem" "public"."rs_origem_candidatura", "p_ator" "jsonb", "p_consentimento" "text", "p_talentos" boolean, "p_token_hash" "text", "p_max_por_vaga" integer, "p_convite" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_vaga public.rs_vagas;
  v_empresa public.rs_empresas;
  v_candidato uuid;
  v_existente public.rs_candidaturas;
  v_etapa uuid;
  v_id uuid;
  v_email extensions.citext := pg_catalog.lower(pg_catalog.btrim(p_candidato ->> 'email'))::extensions.citext;
  v_item jsonb;
  v_pergunta public.rs_perguntas;
  v_sinalizada boolean := false;
  v_origem public.rs_origem_candidatura := p_origem;
begin
  select * into v_empresa from public.rs_empresas where id = p_empresa and excluida_em is null and suspensa_em is null;
  select * into v_vaga from public.rs_vagas where id = p_vaga and empresa_id = p_empresa for share;
  if v_empresa.id is null or v_vaga.id is null or v_vaga.status <> 'publicada' then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  select id into v_candidato from public.rs_candidatos
   where empresa_id = p_empresa and email operator(extensions.=) v_email for update;
  if v_candidato is not null then
    select * into v_existente from public.rs_candidaturas where vaga_id = p_vaga and candidato_id = v_candidato for update;
    if v_existente.id is not null then
      -- 11.3: não cria outra nem muda nada; o servidor gira o link (rs_fn_troca_link) para reenviá-lo.
      return pg_catalog.jsonb_build_object('id', v_existente.id, 'existente', true, 'recebida', v_existente.recebida_em is not null);
    end if;
  end if;
  if (select count(*) from public.rs_candidaturas where vaga_id = p_vaga) >= p_max_por_vaga then
    raise exception 'limite_candidaturas_vaga' using errcode = 'P0001';
  end if;
  if v_candidato is null then
    insert into public.rs_candidatos (empresa_id, email, nome, telefone, linkedin_url, cidade)
    values (p_empresa, v_email, p_candidato ->> 'nome', nullif(p_candidato ->> 'telefone', ''),
            nullif(p_candidato ->> 'linkedin_url', ''), nullif(p_candidato ->> 'cidade', ''))
    returning id into v_candidato;
  end if;
  -- Cadastro que já existe não muda: o e-mail não é verificado, então quem o souber não pode
  -- trocar o nome nem preencher o telefone de outra pessoa (achado do verifier do 8.4).
  -- Convite do banco de talentos (8.7): vale só se for desta empresa, desta vaga, desta pessoa
  -- (mesmo e-mail) e estiver no prazo; aí a origem é banco_talentos e o convite fica usado.
  -- Convite que não vale não é erro: a candidatura segue com a origem recebida.
  -- Usado por uma candidatura que não existe mais (a faxina apaga a não concluída em 24 h) volta a
  -- valer: a pessoa só tem uma candidatura por vaga (11.3), então chegar aqui é prova disso.
  if p_convite is not null and exists (select 1 from public.rs_convites_talento t where t.id = p_convite and t.empresa_id = p_empresa
       and t.vaga_id = p_vaga and t.candidato_id = v_candidato and t.expira_em > pg_catalog.now()) then
    v_origem := 'banco_talentos';
    update public.rs_convites_talento set usado_em = pg_catalog.now() where id = p_convite;
  end if;
  select id into v_etapa from public.rs_etapas where vaga_id = p_vaga order by ordem limit 1;
  insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash,
                                      consentimento_versao, consentimento_em, talentos_pedido)
  values (p_empresa, p_vaga, v_candidato, v_etapa, v_origem, p_token_hash, p_consentimento, pg_catalog.now(), coalesce(p_talentos, false))
  returning id into v_id;
  for v_item in select * from pg_catalog.jsonb_array_elements(coalesce(p_respostas, '[]')) loop
    select * into v_pergunta from public.rs_perguntas where id = (v_item ->> 'pergunta_id')::uuid and vaga_id = p_vaga;
    if v_pergunta.id is null then
      raise exception 'pergunta_invalida' using errcode = 'P0001';
    end if;
    if nullif(v_item ->> 'valor', '') is not null then
      insert into public.rs_respostas (candidatura_id, pergunta_id, valor) values (v_id, v_pergunta.id, v_item ->> 'valor');
      -- 11.10: resposta diferente do requisito declarado só sinaliza; nunca move nem reprova.
      if v_pergunta.resposta_esperada is not null and v_item ->> 'valor' <> v_pergunta.resposta_esperada then
        v_sinalizada := true;
      end if;
    end if;
  end loop;
  -- Pergunta obrigatória sem resposta: só a manual (11.2) passa sem as respostas.
  if v_origem <> 'manual' and exists (
    select 1 from public.rs_perguntas p where p.vaga_id = p_vaga and p.obrigatoria
       and not exists (select 1 from public.rs_respostas r where r.candidatura_id = v_id and r.pergunta_id = p.id)
  ) then
    raise exception 'resposta_obrigatoria' using errcode = 'P0001';
  end if;
  update public.rs_candidaturas set sinalizada = v_sinalizada where id = v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'existente', false, 'recebida', false);
end $$;


ALTER FUNCTION "public"."rs_fn_cria_candidatura"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidato" "jsonb", "p_respostas" "jsonb", "p_origem" "public"."rs_origem_candidatura", "p_ator" "jsonb", "p_consentimento" "text", "p_talentos" boolean, "p_token_hash" "text", "p_max_por_vaga" integer, "p_convite" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_cria_vaga"("p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb", "p_chave" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_area uuid := nullif(p_dados ->> 'area_id', '')::uuid;
  v_dono uuid := nullif(p_dados ->> 'dono_pessoa_id', '')::uuid;
  v_id uuid;
begin
  if p_chave is not null then
    select id into v_id from public.rs_vagas where empresa_id = p_empresa and chave_idempotencia = p_chave;
    if v_id is not null then
      return pg_catalog.jsonb_build_object('id', v_id, 'criada', false);
    end if;
  end if;
  perform public.rs_fn_confere_vaga(p_empresa, v_area, v_dono, p_alcance);
  if v_dono is null and v_area is not null then
    select responsavel_pessoa_id into v_dono from public.rs_areas where id = v_area;
  end if;
  insert into public.rs_vagas (empresa_id, slug, titulo, descricao, requisitos, area_id, dono_pessoa_id,
    modelo_trabalho, cidade, uf, regime, salario_min, salario_max, salario_periodo, mostrar_salario,
    curriculo_obrigatorio, encerra_em, chave_idempotencia)
  values (p_empresa,
    public.rs_fn_slug_vaga(p_empresa, coalesce(nullif(p_dados ->> 'slug', ''), p_dados ->> 'titulo'), null),
    p_dados ->> 'titulo', coalesce(p_dados ->> 'descricao', ''), nullif(p_dados ->> 'requisitos', ''),
    v_area, v_dono,
    coalesce((p_dados ->> 'modelo_trabalho')::public.rs_modelo_trabalho, 'presencial'),
    nullif(p_dados ->> 'cidade', ''), nullif(p_dados ->> 'uf', ''),
    coalesce((p_dados ->> 'regime')::public.rs_regime, 'clt'),
    (p_dados ->> 'salario_min')::numeric, (p_dados ->> 'salario_max')::numeric, nullif(p_dados ->> 'salario_periodo', ''),
    coalesce((p_dados ->> 'mostrar_salario')::boolean, false), coalesce((p_dados ->> 'curriculo_obrigatorio')::boolean, true),
    (nullif(p_dados ->> 'encerra_em', ''))::date, p_chave)
  returning id into v_id;
  perform public.rs_fn_grava_etapas(v_id, p_dados -> 'etapas');
  perform public.rs_fn_grava_perguntas(v_id, coalesce(p_dados -> 'perguntas', '[]'));
  perform public.rs_fn_grava_equipe(v_id, p_empresa, coalesce(p_dados -> 'equipe', '{}'));
  perform public.rs_fn_registra_evento(p_empresa, v_id, null, 'vaga_criada', p_ator, 'web',
    pg_catalog.jsonb_build_object('vaga_id', v_id));
  return pg_catalog.jsonb_build_object('id', v_id, 'criada', true);
end $$;


ALTER FUNCTION "public"."rs_fn_cria_vaga"("p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb", "p_chave" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_decide"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_motivo text;
begin
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  v_motivo := public.rs_fn_alvo_da_decisao(p_empresa, p_tipo, p_candidatura, p_vaga, p_alcance);
  if v_motivo is not null then
    raise exception '%', case when v_motivo = 'nao_encontrado' then 'nao_encontrado' else 'transicao_proibida' end using errcode = 'P0001';
  end if;
  return public.rs_fn_executa_decisao(p_empresa, p_tipo, p_candidatura, p_vaga, p_payload, p_mensagens, p_ator, null);
end $$;


ALTER FUNCTION "public"."rs_fn_decide"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_descarta_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_motivo" "text", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare d public.rs_decisoes;
begin
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  select * into d from public.rs_decisoes where id = p_decisao and empresa_id = p_empresa for update;
  if d.id is null or public.rs_fn_alvo_da_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, p_alcance) = 'nao_encontrado' then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if d.status <> 'pendente' then
    raise exception 'proposta_invalida' using errcode = 'P0001';
  end if;
  update public.rs_decisoes set status = 'descartada', decidida_por_membro_id = (p_ator ->> 'membro_id')::uuid, decidida_em = pg_catalog.now()
   where id = d.id;
  perform public.rs_fn_registra_evento(p_empresa, d.vaga_id, d.candidatura_id, 'decisao_descartada', p_ator, 'web',
    pg_catalog.jsonb_build_object('decisao_id', d.id, 'tipo', d.tipo));
end $$;


ALTER FUNCTION "public"."rs_fn_descarta_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_motivo" "text", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_encerra_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_situacao" "public"."rs_situacao_candidatura", "p_ator" "jsonb", "p_motivo" "public"."rs_motivo_reprovacao", "p_mensagem" "jsonb", "p_dados" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_retencao smallint;
  v_notificacao uuid;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null or v.recebida_em is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'candidatura_anonimizada' using errcode = 'P0001';
  end if;
  if v.situacao <> 'ativa' or p_situacao = 'ativa' then
    raise exception 'transicao_proibida' using errcode = 'P0001';
  end if;
  -- 11.5: reprovar e encerrar com a vaga exigem devolutiva de 20 a 3.000 caracteres, em todo caminho.
  if p_situacao in ('reprovada', 'encerrada_vaga') and (p_mensagem is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_mensagem ->> 'corpo', ''))) not between 20 and 3000) then
    raise exception 'devolutiva_obrigatoria' using errcode = 'P0001';
  end if;
  select retencao_dias into v_retencao from public.rs_empresas where id = p_empresa;
  perform pg_catalog.set_config('rs.transicao', 'on', true);
  update public.rs_candidaturas set situacao = p_situacao, encerrada_em = pg_catalog.now(),
         expurgar_em = pg_catalog.now() + pg_catalog.make_interval(days => v_retencao),
         motivo_reprovacao = case when p_situacao = 'reprovada' then p_motivo end
   where id = p_candidatura;
  perform pg_catalog.set_config('rs.transicao', 'off', true);
  if p_mensagem is not null then
    insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
    values (p_empresa, p_candidatura, (p_mensagem -> 'notificacao' ->> 'tipo')::public.rs_tipo_notificacao,
            p_mensagem -> 'notificacao' ->> 'destinatario', p_mensagem -> 'notificacao' ->> 'chave',
            p_mensagem -> 'notificacao' ->> 'assunto', p_mensagem -> 'notificacao' ->> 'html', p_mensagem -> 'notificacao' ->> 'texto',
            nullif(p_mensagem -> 'notificacao' ->> 'reply_to', ''))
    returning id into v_notificacao;
    insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, membro_id, credencial_id, notificacao_id)
    values (p_empresa, p_candidatura, (p_mensagem ->> 'tipo')::public.rs_tipo_mensagem, p_mensagem ->> 'assunto', p_mensagem ->> 'corpo',
            (p_ator ->> 'tipo')::public.rs_tipo_ator, (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid, v_notificacao);
  end if;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_' || p_situacao::text, p_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura) || coalesce(p_dados, '{}'));
  return pg_catalog.jsonb_build_object('notificacao_id', v_notificacao);
end $$;


ALTER FUNCTION "public"."rs_fn_encerra_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_situacao" "public"."rs_situacao_candidatura", "p_ator" "jsonb", "p_motivo" "public"."rs_motivo_reprovacao", "p_mensagem" "jsonb", "p_dados" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_envia_mensagem"("p_candidatura" "uuid", "p_empresa" "uuid", "p_tipo" "public"."rs_tipo_mensagem", "p_mensagem" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid", "p_cota" integer) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_notificacao uuid;
  v_id uuid;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'candidatura_anonimizada' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_mensagem ->> 'corpo', ''))) not between 2 and 5000
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_mensagem ->> 'assunto', ''))) not between 2 and 200 then
    raise exception 'mensagem_invalida' using errcode = 'P0001';
  end if;
  if p_cota is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mensagens_api:' || p_empresa::text));
    if (select count(*) from public.rs_mensagens where empresa_id = p_empresa and ator_tipo = 'api'
         and criado_em > pg_catalog.now() - interval '1 day') >= p_cota then
      raise exception 'limite_mensagens' using errcode = 'P0001';
    end if;
  end if;
  insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
  values (p_empresa, p_candidatura, 'mensagem_candidato', p_mensagem -> 'notificacao' ->> 'destinatario',
          p_mensagem -> 'notificacao' ->> 'chave', p_mensagem -> 'notificacao' ->> 'assunto', p_mensagem -> 'notificacao' ->> 'html',
          p_mensagem -> 'notificacao' ->> 'texto', nullif(p_mensagem -> 'notificacao' ->> 'reply_to', ''))
  returning id into v_notificacao;
  insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, membro_id, credencial_id, decisao_id, notificacao_id)
  values (p_empresa, p_candidatura, p_tipo, p_mensagem ->> 'assunto', p_mensagem ->> 'corpo', (p_ator ->> 'tipo')::public.rs_tipo_ator,
          (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid, p_decisao, v_notificacao)
  returning id into v_id;
  update public.rs_candidaturas set atualizado_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'mensagem_enviada', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'mensagem_id', v_id, 'tipo', p_tipo, 'decisao_id', p_decisao));
  return v_id;
end $$;


ALTER FUNCTION "public"."rs_fn_envia_mensagem"("p_candidatura" "uuid", "p_empresa" "uuid", "p_tipo" "public"."rs_tipo_mensagem", "p_mensagem" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid", "p_cota" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_exclui_dados_candidato"("p_candidatura" "uuid", "p_empresa" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_outra record;
  v_paths text[] := '{}';
  v_ator jsonb := pg_catalog.jsonb_build_object('tipo', 'candidato', 'origem', 'publico');
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  for v_outra in select id from public.rs_candidaturas where candidato_id = v.candidato_id and empresa_id = p_empresa
                 and situacao = 'ativa' and recebida_em is not null loop
    perform public.rs_fn_encerra_candidatura(v_outra.id, p_empresa, 'desistiu', v_ator, null, null,
      pg_catalog.jsonb_build_object('por_exclusao', true));
  end loop;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'dados_excluidos', v_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  for v_outra in select id from public.rs_candidaturas where candidato_id = v.candidato_id and empresa_id = p_empresa loop
    v_paths := v_paths || public.rs_fn_anonimiza_candidatura(v_outra.id, p_empresa);
  end loop;
  update public.rs_candidatos set nome = 'Pessoa removida', email = null, telefone = null, linkedin_url = null, cidade = null,
         talentos_consentido_em = null, talentos_expira_em = null, anonimizado_em = pg_catalog.now()
   where id = v.candidato_id;
  return v_paths;
end $$;


ALTER FUNCTION "public"."rs_fn_exclui_dados_candidato"("p_candidatura" "uuid", "p_empresa" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_executa_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_c record;
  v_n integer := 0;
  v_dados jsonb := pg_catalog.jsonb_build_object('decisao_id', p_decisao);
begin
  -- Defesa em profundidade (11.7): o executor também exige um membro como ator.
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  if p_tipo = 'reprovar' then
    perform public.rs_fn_encerra_candidatura(p_candidatura, p_empresa, 'reprovada', p_ator,
      coalesce(nullif(p_payload ->> 'motivo', ''), 'outro')::public.rs_motivo_reprovacao, p_mensagens -> p_candidatura::text, v_dados);
    return 1;
  elsif p_tipo = 'contratar' then
    perform public.rs_fn_encerra_candidatura(p_candidatura, p_empresa, 'contratada', p_ator, null, p_mensagens -> p_candidatura::text, v_dados);
    return 1;
  elsif p_tipo = 'enviar_mensagem' then
    perform public.rs_fn_envia_mensagem(p_candidatura, p_empresa, coalesce(p_mensagens -> p_candidatura::text ->> 'tipo', 'contato')::public.rs_tipo_mensagem,
      p_mensagens -> p_candidatura::text, p_ator, p_decisao, null);
    return 1;
  end if;
  -- encerrar_vaga: todas as recebidas em andamento recebem a devolutiva (11.5); depois, a vaga.
  if (select count(*) from public.rs_candidaturas where vaga_id = p_vaga and empresa_id = p_empresa and situacao = 'ativa'
       and recebida_em is not null) > 1000 then
    raise exception 'lote_grande_demais' using errcode = 'P0001';
  end if;
  for v_c in select id from public.rs_candidaturas where vaga_id = p_vaga and empresa_id = p_empresa and situacao = 'ativa'
              and recebida_em is not null order by id for update loop
    perform public.rs_fn_encerra_candidatura(v_c.id, p_empresa, 'encerrada_vaga', p_ator, null, p_mensagens -> v_c.id::text, v_dados);
    v_n := v_n + 1;
  end loop;
  perform public.rs_fn_transicao_vaga(p_vaga, p_empresa, 'encerrada',
    coalesce(nullif(p_payload ->> 'motivo_encerramento', ''), 'outro')::public.rs_motivo_encerramento_vaga,
    '{"tipo":"todas"}', p_ator, 50);
  return v_n;
end $$;


ALTER FUNCTION "public"."rs_fn_executa_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_faxina_candidaturas_abandonadas"("p_lote" integer) RETURNS "text"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v record;
  v_prefixos text[] := '{}';
begin
  for v in select id, empresa_id, candidato_id from public.rs_candidaturas
            where recebida_em is null and criado_em < pg_catalog.now() - interval '24 hours'
            order by criado_em limit p_lote for update skip locked loop
    v_prefixos := v_prefixos || (v.empresa_id::text || '/' || v.id::text || '/');
    delete from public.rs_candidaturas where id = v.id;
    delete from public.rs_candidatos k where k.id = v.candidato_id and k.talentos_consentido_em is null
       and not exists (select 1 from public.rs_candidaturas c where c.candidato_id = k.id);
  end loop;
  delete from public.rs_tentativas_publicas where criado_em < pg_catalog.now() - interval '24 hours';
  return v_prefixos;
end $$;


ALTER FUNCTION "public"."rs_fn_faxina_candidaturas_abandonadas"("p_lote" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_faxina_decisoes"("p_lote" integer) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  d record;
  v_n integer := 0;
begin
  for d in select id, empresa_id, vaga_id, candidatura_id from public.rs_decisoes
            where status = 'pendente' and expira_em <= pg_catalog.now() order by expira_em limit p_lote for update skip locked loop
    update public.rs_decisoes set status = 'expirada', decidida_em = pg_catalog.now() where id = d.id;
    perform public.rs_fn_registra_evento(d.empresa_id, d.vaga_id, d.candidatura_id, 'decisao_expirada',
      '{"tipo":"sistema","origem":"cron"}', 'cron', pg_catalog.jsonb_build_object('decisao_id', d.id, 'motivo', 'venceu'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;


ALTER FUNCTION "public"."rs_fn_faxina_decisoes"("p_lote" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_faxina_talentos"("p_lote" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  k record;
  v_retirados integer := 0;
  v_avisar jsonb := '[]';
  v_cand uuid;
begin
  for k in select id, empresa_id from public.rs_candidatos where talentos_expira_em <= pg_catalog.now()
            order by talentos_expira_em limit p_lote for update skip locked loop
    update public.rs_candidatos set talentos_consentido_em = null, talentos_expira_em = null, talentos_avisado_em = null where id = k.id;
    perform public.rs_fn_registra_evento(k.empresa_id, null, null, 'talentos_retirado', '{"tipo":"sistema","origem":"cron"}', 'cron',
      pg_catalog.jsonb_build_object('candidato_id', k.id, 'motivo', 'venceu'));
    v_retirados := v_retirados + 1;
  end loop;
  for k in select id, empresa_id, talentos_expira_em from public.rs_candidatos
            where talentos_expira_em > pg_catalog.now() and talentos_expira_em <= pg_catalog.now() + interval '30 days'
              and talentos_avisado_em is null and anonimizado_em is null
              -- Empresa suspensa ou excluída não manda o aviso; ele fica para quando ela voltar.
              and exists (select 1 from public.rs_empresas e where e.id = rs_candidatos.empresa_id and e.excluida_em is null and e.suspensa_em is null)
            order by talentos_expira_em limit p_lote for update skip locked loop
    select id into v_cand from public.rs_candidaturas where candidato_id = k.id and recebida_em is not null
       and token_hash not like 'anonimizada:%' order by recebida_em desc limit 1;
    update public.rs_candidatos set talentos_avisado_em = pg_catalog.now() where id = k.id;
    if v_cand is not null then
      v_avisar := v_avisar || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('empresa_id', k.empresa_id, 'candidato_id', k.id,
        'candidatura_id', v_cand, 'expira_em', k.talentos_expira_em));
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('retirados', v_retirados, 'avisar', v_avisar);
end $$;


ALTER FUNCTION "public"."rs_fn_faxina_talentos"("p_lote" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_faxina_vagas_vencidas"("p_lote" integer) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v record;
  v_n integer := 0;
begin
  for v in
    select id, empresa_id from public.rs_vagas
     where status = 'publicada' and encerra_em < (pg_catalog.now() at time zone 'America/Sao_Paulo')::date
     order by encerra_em limit p_lote
     for update skip locked
  loop
    update public.rs_vagas set status = 'pausada' where id = v.id;
    perform public.rs_fn_registra_evento(v.empresa_id, v.id, null, 'vaga_pausada_prazo',
      pg_catalog.jsonb_build_object('tipo', 'sistema'), 'cron', pg_catalog.jsonb_build_object('vaga_id', v.id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;


ALTER FUNCTION "public"."rs_fn_faxina_vagas_vencidas"("p_lote" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_grava_equipe"("p_vaga" "uuid", "p_empresa" "uuid", "p_equipe" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_resp uuid := nullif(p_equipe ->> 'responsavel', '')::uuid;
  v_dono_membro uuid;
  v_av uuid;
begin
  if v_resp is not null and not exists (
    select 1 from public.rs_membros where id = v_resp and empresa_id = p_empresa and removido_em is null
       and usuario_id is not null and papel in ('administrador', 'recrutador')
  ) then
    raise exception 'responsavel_invalido' using errcode = 'P0001';
  end if;
  delete from public.rs_vaga_equipe where vaga_id = p_vaga;
  if v_resp is not null then
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga) values (p_vaga, v_resp, 'responsavel');
  end if;
  for v_av in select distinct (x)::uuid from pg_catalog.jsonb_array_elements_text(coalesce(p_equipe -> 'avaliadores', '[]')) x loop
    if not exists (select 1 from public.rs_membros where id = v_av and empresa_id = p_empresa
                   and removido_em is null and usuario_id is not null) then
      raise exception 'membro_invalido' using errcode = 'P0001';
    end if;
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga)
    values (p_vaga, v_av, 'avaliador') on conflict (vaga_id, membro_id) do nothing;
  end loop;
  select p.membro_id into v_dono_membro from public.rs_vagas v join public.rs_pessoas p on p.id = v.dono_pessoa_id
   join public.rs_membros m on m.id = p.membro_id
   where v.id = p_vaga and m.removido_em is null and m.usuario_id is not null;
  if v_dono_membro is not null then
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga)
    values (p_vaga, v_dono_membro, 'avaliador') on conflict (vaga_id, membro_id) do nothing;
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_grava_equipe"("p_vaga" "uuid", "p_empresa" "uuid", "p_equipe" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_grava_etapas"("p_vaga" "uuid", "p_etapas" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_item jsonb;
  v_ordem integer := 0;
  v_ids uuid[] := '{}';
begin
  if p_etapas is null or pg_catalog.jsonb_typeof(p_etapas) <> 'array'
     or pg_catalog.jsonb_array_length(p_etapas) not between 1 and 15 then
    raise exception 'etapas_invalidas' using errcode = 'P0001';
  end if;
  for v_item in select * from pg_catalog.jsonb_array_elements(p_etapas) loop
    if v_item ? 'id' and v_item ->> 'id' is not null then
      if not exists (select 1 from public.rs_etapas where id = (v_item ->> 'id')::uuid and vaga_id = p_vaga) then
        raise exception 'etapas_invalidas' using errcode = 'P0001';
      end if;
      v_ids := v_ids || (v_item ->> 'id')::uuid;
    end if;
  end loop;
  if exists (select 1 from public.rs_candidaturas c join public.rs_etapas e on e.id = c.etapa_id
             where e.vaga_id = p_vaga and not (e.id = any (v_ids))) then
    raise exception 'etapa_com_candidaturas' using errcode = 'P0001';
  end if;
  delete from public.rs_etapas where vaga_id = p_vaga and not (id = any (v_ids));
  -- A ordem é única e adiável (initially deferred): renumerar no meio da transação não colide.
  for v_item in select * from pg_catalog.jsonb_array_elements(p_etapas) loop
    v_ordem := v_ordem + 1;
    if v_item ? 'id' and v_item ->> 'id' is not null then
      update public.rs_etapas set nome = v_item ->> 'nome', tipo = (v_item ->> 'tipo')::public.rs_tipo_etapa, ordem = v_ordem
       where id = (v_item ->> 'id')::uuid;
    else
      insert into public.rs_etapas (vaga_id, nome, tipo, ordem)
      values (p_vaga, v_item ->> 'nome', (v_item ->> 'tipo')::public.rs_tipo_etapa, v_ordem);
    end if;
  end loop;
end $$;


ALTER FUNCTION "public"."rs_fn_grava_etapas"("p_vaga" "uuid", "p_etapas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_grava_extracao"("p_arquivo" "uuid", "p_status" "public"."rs_status_extracao", "p_texto" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_candidatura uuid;
begin
  update public.rs_arquivos set extracao_status = p_status, texto_extraido = pg_catalog.left(p_texto, 100000)
   where id = p_arquivo returning candidatura_id into v_candidatura;
  if v_candidatura is not null then
    perform public.rs_fn_atualiza_busca(v_candidatura);
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_grava_extracao"("p_arquivo" "uuid", "p_status" "public"."rs_status_extracao", "p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_grava_perguntas"("p_vaga" "uuid", "p_perguntas" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_publicada timestamptz;
  v_atual jsonb;
  v_nova jsonb;
  v_item jsonb;
  v_ordem integer := 0;
begin
  if p_perguntas is null or pg_catalog.jsonb_typeof(p_perguntas) <> 'array'
     or pg_catalog.jsonb_array_length(p_perguntas) > 10 then
    raise exception 'perguntas_invalidas' using errcode = 'P0001';
  end if;
  select publicada_em into v_publicada from public.rs_vagas where id = p_vaga;
  if v_publicada is not null then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('texto', texto, 'tipo', tipo,
             'opcoes', coalesce(pg_catalog.to_jsonb(opcoes), '[]'::jsonb), 'obrigatoria', obrigatoria,
             'resposta_esperada', resposta_esperada) order by ordem), '[]'::jsonb)
      into v_atual from public.rs_perguntas where vaga_id = p_vaga;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('texto', p ->> 'texto', 'tipo', p ->> 'tipo',
             'opcoes', coalesce(p -> 'opcoes', '[]'::jsonb), 'obrigatoria', coalesce((p ->> 'obrigatoria')::boolean, true),
             'resposta_esperada', p ->> 'resposta_esperada') order by n), '[]'::jsonb)
      into v_nova from pg_catalog.jsonb_array_elements(p_perguntas) with ordinality as x(p, n);
    if v_atual is distinct from v_nova then
      raise exception 'perguntas_congeladas' using errcode = 'P0001';
    end if;
    return;
  end if;
  delete from public.rs_perguntas where vaga_id = p_vaga;
  for v_item in select * from pg_catalog.jsonb_array_elements(p_perguntas) loop
    v_ordem := v_ordem + 1;
    insert into public.rs_perguntas (vaga_id, ordem, texto, tipo, opcoes, obrigatoria, resposta_esperada)
    values (p_vaga, v_ordem, v_item ->> 'texto', (v_item ->> 'tipo')::public.rs_tipo_pergunta,
            case when (v_item ->> 'tipo') = 'escolha_unica'
                 then array(select pg_catalog.jsonb_array_elements_text(v_item -> 'opcoes')) end,
            coalesce((v_item ->> 'obrigatoria')::boolean, true), nullif(v_item ->> 'resposta_esperada', ''));
  end loop;
end $$;


ALTER FUNCTION "public"."rs_fn_grava_perguntas"("p_vaga" "uuid", "p_perguntas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_lista_candidaturas"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) RETURNS TABLE("id" "uuid", "vaga_id" "uuid", "etapa_id" "uuid", "situacao" "text", "sinalizada" boolean, "nome" "text", "recebida_em" timestamp with time zone, "movida_em" timestamp with time zone, "encerrada_em" timestamp with time zone, "atualizado_em" timestamp with time zone, "relevancia" real)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
declare
  v_q text := nullif(pg_catalog.btrim(p_filtros ->> 'q'), '');
  v_tsq tsquery := case when v_q is null then null
                        else pg_catalog.websearch_to_tsquery('pg_catalog.portuguese', extensions.unaccent(v_q)) end;
  v_situacao text := coalesce(nullif(p_filtros ->> 'situacao', ''), 'ativa');
  v_pendente uuid := nullif(p_filtros ->> 'pendente_de', '')::uuid;
begin
  return query
  select c.id, c.vaga_id, c.etapa_id, c.situacao::text, c.sinalizada, k.nome, c.recebida_em, c.movida_em, c.encerrada_em,
         c.atualizado_em,
         case when v_tsq is null then null else pg_catalog.ts_rank(c.texto_busca, v_tsq) end
    from public.rs_candidaturas c
    join public.rs_vagas v on v.id = c.vaga_id
    join public.rs_candidatos k on k.id = c.candidato_id
   where c.empresa_id = p_empresa
     and c.recebida_em is not null
     and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance)
     and (v_situacao = 'todas' or c.situacao::text = v_situacao)
     and (p_filtros ->> 'vaga_id' is null or c.vaga_id = (p_filtros ->> 'vaga_id')::uuid)
     and (p_filtros ->> 'etapa_id' is null or c.etapa_id = (p_filtros ->> 'etapa_id')::uuid)
     and (p_filtros ->> 'sinalizada' is null or c.sinalizada = (p_filtros ->> 'sinalizada')::boolean)
     and (p_filtros ->> 'parada_desde' is null
          or (c.situacao = 'ativa' and c.movida_em < (p_filtros ->> 'parada_desde')::timestamptz))
     and (p_filtros ->> 'atualizada_desde' is null or c.atualizado_em >= (p_filtros ->> 'atualizada_desde')::timestamptz)
     and (v_pendente is null or (
           c.situacao = 'ativa'
           and exists (select 1 from public.rs_vaga_equipe q where q.vaga_id = c.vaga_id and q.membro_id = v_pendente)
           and not exists (select 1 from public.rs_avaliacoes a where a.candidatura_id = c.id and a.etapa_id = c.etapa_id
                           and a.membro_id = v_pendente)))
     and (v_tsq is null or c.texto_busca @@ v_tsq)
   order by
     case when v_tsq is not null then pg_catalog.ts_rank(c.texto_busca, v_tsq) end desc nulls last,
     case when v_tsq is null and p_filtros ->> 'ordem' = 'movimentacao' then c.movida_em end desc nulls last,
     c.recebida_em, c.id
   offset greatest(p_inicio, 0) limit greatest(p_limite, 0);
end $$;


ALTER FUNCTION "public"."rs_fn_lista_candidaturas"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_move_etapa"("p_ids" "uuid"[], "p_empresa" "uuid", "p_etapa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_ids uuid[] := (select pg_catalog.array_agg(distinct x) from pg_catalog.unnest(p_ids) x);
  v_etapa public.rs_etapas;
  v_vaga public.rs_vagas;
  v record;
  v_achadas integer;
  v_movidas integer := 0;
begin
  if v_ids is null or pg_catalog.cardinality(v_ids) = 0 or pg_catalog.cardinality(v_ids) > 100 then
    raise exception 'lote_invalido' using errcode = 'P0001';
  end if;
  select * into v_etapa from public.rs_etapas where id = p_etapa;
  select * into v_vaga from public.rs_vagas where id = v_etapa.vaga_id and empresa_id = p_empresa;
  if v_vaga.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'etapa_nao_encontrada' using errcode = 'P0001';
  end if;
  -- Trava as linhas antes de conferir, para o lote valer inteiro ou nada.
  perform 1 from public.rs_candidaturas c where c.id = any (v_ids) and c.empresa_id = p_empresa order by c.id for update;
  select count(*) into v_achadas from public.rs_candidaturas c join public.rs_vagas w on w.id = c.vaga_id
   where c.id = any (v_ids) and c.empresa_id = p_empresa and c.recebida_em is not null
     and public.rs_fn_vaga_no_alcance(w.id, w.area_id, p_alcance);
  if v_achadas <> pg_catalog.cardinality(v_ids) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidaturas where id = any (v_ids) and vaga_id <> v_vaga.id) then
    raise exception 'etapa_de_outra_vaga' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidaturas where id = any (v_ids) and situacao <> 'ativa') then
    raise exception 'candidatura_nao_ativa' using errcode = 'P0001';
  end if;
  for v in select c.id, c.etapa_id from public.rs_candidaturas c
            where c.id = any (v_ids) and c.etapa_id is distinct from p_etapa order by c.id loop
    update public.rs_candidaturas set etapa_id = p_etapa, movida_em = pg_catalog.now() where id = v.id;
    perform public.rs_fn_registra_evento(p_empresa, v_vaga.id, v.id, 'etapa_alterada', p_ator, 'web',
      pg_catalog.jsonb_build_object('candidatura_id', v.id, 'de', v.etapa_id, 'para', p_etapa));
    v_movidas := v_movidas + 1;
  end loop;
  return v_movidas;
end $$;


ALTER FUNCTION "public"."rs_fn_move_etapa"("p_ids" "uuid"[], "p_empresa" "uuid", "p_etapa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_novo_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_validade_s" integer, "p_intervalo_s" integer, "p_max_hora" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura for update;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    return 'indisponivel';
  end if;
  if v.exclusao_janela_desde is null or v.exclusao_janela_desde < pg_catalog.now() - interval '1 hour' then
    v.exclusao_janela_desde := pg_catalog.now();
    v.exclusao_codigos_hora := 0;
  end if;
  if v.exclusao_codigos_hora >= p_max_hora then
    return 'limite_hora';
  end if;
  if v.exclusao_expira_em is not null
     and v.exclusao_expira_em - pg_catalog.make_interval(secs => p_validade_s) + pg_catalog.make_interval(secs => p_intervalo_s) > pg_catalog.now() then
    return 'aguarde';
  end if;
  update public.rs_candidaturas set exclusao_codigo_hash = p_codigo_hash,
         exclusao_expira_em = pg_catalog.now() + pg_catalog.make_interval(secs => p_validade_s),
         exclusao_tentativas = 0, exclusao_codigos_hora = v.exclusao_codigos_hora + 1, exclusao_janela_desde = v.exclusao_janela_desde
   where id = p_candidatura;
  return 'ok';
end $$;


ALTER FUNCTION "public"."rs_fn_novo_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_validade_s" integer, "p_intervalo_s" integer, "p_max_hora" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_pede_revisao"("p_candidatura" "uuid", "p_texto" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura for update;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.situacao not in ('reprovada', 'encerrada_vaga') or v.revisao_pedida_em is not null
     or (v.expurgar_em is not null and v.expurgar_em <= pg_catalog.now()) then
    raise exception 'revisao_indisponivel' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(coalesce(p_texto, '')) > 1000 then
    raise exception 'revisao_texto_longo' using errcode = 'P0001';
  end if;
  update public.rs_candidaturas set revisao_pedida_em = pg_catalog.now(), revisao_texto = nullif(pg_catalog.btrim(coalesce(p_texto, '')), '')
   where id = p_candidatura;
  perform public.rs_fn_registra_evento(v.empresa_id, v.vaga_id, p_candidatura, 'revisao_pedida',
    '{"tipo":"candidato","origem":"publico"}', 'publico', pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  return v.vaga_id;
end $$;


ALTER FUNCTION "public"."rs_fn_pede_revisao"("p_candidatura" "uuid", "p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_propoe_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_justificativa" "text", "p_ator" "jsonb", "p_alcance" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_vaga uuid := p_vaga;
  v_motivo text;
begin
  if p_ator ->> 'tipo' not in ('api', 'agente') or p_ator ->> 'credencial_id' is null then
    raise exception 'ator_invalido' using errcode = 'P0001';
  end if;
  v_motivo := public.rs_fn_alvo_da_decisao(p_empresa, p_tipo, p_candidatura, p_vaga, p_alcance);
  if v_motivo is not null then
    raise exception '%', case when v_motivo = 'nao_encontrado' then 'nao_encontrado' else 'transicao_proibida' end using errcode = 'P0001';
  end if;
  if p_tipo = 'encerrar_vaga' then p_candidatura := null;
  else select vaga_id into v_vaga from public.rs_candidaturas where id = p_candidatura; end if;
  begin
    insert into public.rs_decisoes (empresa_id, tipo, candidatura_id, vaga_id, payload, justificativa, proposta_por_tipo,
                                    proposta_por_membro_id, credencial_id)
    values (p_empresa, p_tipo, p_candidatura, case when p_tipo = 'encerrar_vaga' then p_vaga else v_vaga end, coalesce(p_payload, '{}'),
            nullif(pg_catalog.btrim(coalesce(p_justificativa, '')), ''), (p_ator ->> 'tipo')::public.rs_tipo_ator,
            (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'proposta_existente' using errcode = 'P0001';
  end;
  perform public.rs_fn_registra_evento(p_empresa, v_vaga, p_candidatura, 'decisao_proposta', p_ator, 'web',
    pg_catalog.jsonb_build_object('decisao_id', v_id, 'tipo', p_tipo));
  return v_id;
end $$;


ALTER FUNCTION "public"."rs_fn_propoe_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_justificativa" "text", "p_ator" "jsonb", "p_alcance" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_reabre_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
  v_etapa uuid;
begin
  -- Reabrir é decisão (11.23): só com um membro como ator, mesmo chamada direto.
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'candidatura_anonimizada' using errcode = 'P0001';
  end if;
  if v.situacao in ('ativa', 'encerrada_vaga') or (v.expurgar_em is not null and v.expurgar_em <= pg_catalog.now()) then
    raise exception 'transicao_proibida' using errcode = 'P0001';
  end if;
  if v_vaga.status not in ('publicada', 'pausada') then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  v_etapa := coalesce(v.etapa_id, (select id from public.rs_etapas where vaga_id = v.vaga_id order by ordem limit 1));
  perform pg_catalog.set_config('rs.transicao', 'on', true);
  update public.rs_candidaturas set situacao = 'ativa', encerrada_em = null, expurgar_em = null, motivo_reprovacao = null,
         etapa_id = v_etapa, movida_em = pg_catalog.now()
   where id = p_candidatura;
  perform pg_catalog.set_config('rs.transicao', 'off', true);
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_reaberta', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'de', v.situacao));
end $$;


ALTER FUNCTION "public"."rs_fn_reabre_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_registra_avaliacao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_etapa" "uuid", "p_membro" "uuid", "p_recomendacao" "public"."rs_recomendacao", "p_comentario" "text", "p_ator" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_id uuid;
  v_nova boolean;
  v_comentario text := pg_catalog.btrim(coalesce(p_comentario, ''));
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_vaga_equipe where vaga_id = v.vaga_id and membro_id = p_membro) then
    raise exception 'fora_da_equipe' using errcode = 'P0001';
  end if;
  if v.situacao <> 'ativa' then
    raise exception 'candidatura_nao_ativa' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_etapas where id = p_etapa and vaga_id = v.vaga_id) then
    raise exception 'etapa_de_outra_vaga' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(v_comentario) not between 10 and 5000 then
    raise exception 'comentario_invalido' using errcode = 'P0001';
  end if;
  v_nova := not exists (select 1 from public.rs_avaliacoes where candidatura_id = p_candidatura and etapa_id = p_etapa and membro_id = p_membro);
  insert into public.rs_avaliacoes (candidatura_id, etapa_id, membro_id, recomendacao, comentario)
  values (p_candidatura, p_etapa, p_membro, p_recomendacao, v_comentario)
  on conflict (candidatura_id, etapa_id, membro_id)
  do update set recomendacao = excluded.recomendacao, comentario = excluded.comentario
  returning id into v_id;
  update public.rs_candidaturas set atualizado_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'avaliacao_registrada', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'etapa_id', p_etapa, 'recomendacao', p_recomendacao,
      'nova', v_nova));
  return v_id;
end $$;


ALTER FUNCTION "public"."rs_fn_registra_avaliacao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_etapa" "uuid", "p_membro" "uuid", "p_recomendacao" "public"."rs_recomendacao", "p_comentario" "text", "p_ator" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_responde_revisao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_mensagem" "jsonb", "p_reabrir" boolean, "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.revisao_pedida_em is null or v.revisao_respondida_em is not null then
    raise exception 'revisao_indisponivel' using errcode = 'P0001';
  end if;
  if p_reabrir and p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  perform public.rs_fn_envia_mensagem(p_candidatura, p_empresa, 'resposta_revisao', p_mensagem, p_ator, null, null);
  update public.rs_candidaturas set revisao_respondida_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'revisao_respondida', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'reaberta', coalesce(p_reabrir, false)));
  if p_reabrir then
    perform public.rs_fn_reabre_candidatura(p_candidatura, p_empresa, p_alcance, p_ator);
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_responde_revisao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_mensagem" "jsonb", "p_reabrir" boolean, "p_ator" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_salva_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_atual public.rs_vagas;
  v_area uuid := nullif(p_dados ->> 'area_id', '')::uuid;
  v_dono uuid := nullif(p_dados ->> 'dono_pessoa_id', '')::uuid;
  v_slug text;
begin
  select * into v_atual from public.rs_vagas where id = p_vaga and empresa_id = p_empresa for update;
  if v_atual.id is null or not public.rs_fn_vaga_no_alcance(p_vaga, v_atual.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v_atual.status = 'encerrada' then
    raise exception 'vaga_encerrada' using errcode = 'P0001';
  end if;
  if v_area is distinct from v_atual.area_id or v_dono is distinct from v_atual.dono_pessoa_id then
    perform public.rs_fn_confere_vaga(p_empresa, v_area, v_dono, p_alcance);
  end if;
  v_slug := v_atual.slug;
  if v_atual.publicada_em is null and nullif(p_dados ->> 'slug', '') is not null and p_dados ->> 'slug' <> v_atual.slug then
    if exists (select 1 from public.rs_vagas where empresa_id = p_empresa and slug = p_dados ->> 'slug' and id <> p_vaga) then
      raise exception 'slug_vaga_em_uso' using errcode = 'P0001';
    end if;
    v_slug := p_dados ->> 'slug';
  end if;
  update public.rs_vagas set
    slug = v_slug, titulo = p_dados ->> 'titulo', descricao = coalesce(p_dados ->> 'descricao', ''),
    requisitos = nullif(p_dados ->> 'requisitos', ''), area_id = v_area, dono_pessoa_id = v_dono,
    modelo_trabalho = coalesce((p_dados ->> 'modelo_trabalho')::public.rs_modelo_trabalho, 'presencial'),
    cidade = nullif(p_dados ->> 'cidade', ''), uf = nullif(p_dados ->> 'uf', ''),
    regime = coalesce((p_dados ->> 'regime')::public.rs_regime, 'clt'),
    salario_min = (p_dados ->> 'salario_min')::numeric, salario_max = (p_dados ->> 'salario_max')::numeric,
    salario_periodo = nullif(p_dados ->> 'salario_periodo', ''),
    mostrar_salario = coalesce((p_dados ->> 'mostrar_salario')::boolean, false),
    curriculo_obrigatorio = coalesce((p_dados ->> 'curriculo_obrigatorio')::boolean, true),
    encerra_em = (nullif(p_dados ->> 'encerra_em', ''))::date
   where id = p_vaga;
  if p_dados ? 'etapas' then
    perform public.rs_fn_grava_etapas(p_vaga, p_dados -> 'etapas');
  end if;
  if p_dados ? 'perguntas' then
    perform public.rs_fn_grava_perguntas(p_vaga, p_dados -> 'perguntas');
  end if;
  if p_dados ? 'equipe' then
    perform public.rs_fn_grava_equipe(p_vaga, p_empresa, p_dados -> 'equipe');
  elsif v_dono is distinct from v_atual.dono_pessoa_id then
    -- Dono novo com acesso entra na equipe como avaliador mesmo sem a equipe no pedido (11.31).
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga)
    select p_vaga, p.membro_id, 'avaliador' from public.rs_pessoas p join public.rs_membros m on m.id = p.membro_id
     where p.id = v_dono and m.removido_em is null and m.usuario_id is not null
    on conflict (vaga_id, membro_id) do nothing;
  end if;
  perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_editada', p_ator, 'web',
    pg_catalog.jsonb_build_object('vaga_id', p_vaga));
  if v_dono is distinct from v_atual.dono_pessoa_id then
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_dono_alterado', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'de', v_atual.dono_pessoa_id, 'para', v_dono));
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_salva_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_slug_vaga"("p_empresa" "uuid", "p_base" "text", "p_vaga" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := pg_catalog.lower(extensions.unaccent(coalesce(p_base, '')));
  v_base := pg_catalog.regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := pg_catalog.btrim(pg_catalog.left(v_base, 120), '-');
  if v_base = '' then
    v_base := 'vaga';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.rs_vagas where empresa_id = p_empresa and slug = v_slug
                and id is distinct from p_vaga) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;


ALTER FUNCTION "public"."rs_fn_slug_vaga"("p_empresa" "uuid", "p_base" "text", "p_vaga" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_talento_no_alcance"("p_candidato" "uuid", "p_alcance" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  if p_alcance ->> 'tipo' = 'equipe' then return false; end if;
  return exists (select 1 from public.rs_candidaturas c join public.rs_vagas v on v.id = c.vaga_id
                 where c.candidato_id = p_candidato and c.recebida_em is not null
                   and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance));
end $$;


ALTER FUNCTION "public"."rs_fn_talento_no_alcance"("p_candidato" "uuid", "p_alcance" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_talentos_candidato"("p_candidatura" "uuid", "p_acao" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_candidaturas;
  v_meses smallint;
  v_expira timestamptz;
  v_ator jsonb := '{"tipo":"candidato","origem":"publico"}';
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and recebida_em is not null;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if p_acao = 'sair' then
    update public.rs_candidatos set talentos_consentido_em = null, talentos_expira_em = null, talentos_avisado_em = null where id = v.candidato_id;
    perform public.rs_fn_registra_evento(v.empresa_id, v.vaga_id, p_candidatura, 'talentos_retirado', v_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
    return null;
  elsif p_acao in ('entrar', 'renovar') then
    select talentos_meses into v_meses from public.rs_empresas where id = v.empresa_id;
    v_expira := pg_catalog.now() + pg_catalog.make_interval(months => v_meses);
    update public.rs_candidatos set talentos_consentido_em = pg_catalog.now(), talentos_expira_em = v_expira, talentos_avisado_em = null
     where id = v.candidato_id;
    perform public.rs_fn_registra_evento(v.empresa_id, v.vaga_id, p_candidatura, 'talentos_consentido', v_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'acao', p_acao));
    return v_expira;
  end if;
  raise exception 'acao_invalida' using errcode = 'P0001';
end $$;


ALTER FUNCTION "public"."rs_fn_talentos_candidato"("p_candidatura" "uuid", "p_acao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_transicao_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_para" "public"."rs_status_vaga", "p_motivo" "public"."rs_motivo_encerramento_vaga", "p_alcance" "jsonb", "p_ator" "jsonb", "p_max_publicadas" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v public.rs_vagas;
  v_hoje date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into v from public.rs_vagas where id = p_vaga and empresa_id = p_empresa for update;
  if v.id is null or not public.rs_fn_vaga_no_alcance(p_vaga, v.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if not (
    (v.status = 'rascunho' and p_para in ('publicada', 'encerrada'))
    or (v.status = 'publicada' and p_para in ('pausada', 'encerrada'))
    or (v.status = 'pausada' and p_para in ('publicada', 'encerrada'))
  ) then
    raise exception 'transicao_vaga_proibida' using errcode = 'P0001';
  end if;
  if p_para = 'publicada' then
    if pg_catalog.char_length(v.descricao) < 50
       or not exists (select 1 from public.rs_etapas where vaga_id = p_vaga)
       or (v.modelo_trabalho <> 'remoto' and (v.cidade is null or v.uf is null)) then
      raise exception 'vaga_incompleta' using errcode = 'P0001';
    end if;
    if v.encerra_em is not null and v.encerra_em < v_hoje then
      raise exception 'encerra_em_passada' using errcode = 'P0001';
    end if;
    perform 1 from public.rs_empresas where id = p_empresa for update;
    if (select count(*) from public.rs_vagas where empresa_id = p_empresa and status = 'publicada') >= p_max_publicadas then
      raise exception 'limite_publicadas' using errcode = 'P0001';
    end if;
    update public.rs_vagas set status = 'publicada', publicada_em = coalesce(publicada_em, pg_catalog.now()) where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_publicada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'republicada', v.publicada_em is not null));
  elsif p_para = 'pausada' then
    update public.rs_vagas set status = 'pausada' where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_pausada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga));
  else
    if p_motivo is null then
      raise exception 'motivo_obrigatorio' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.rs_candidaturas where vaga_id = p_vaga and situacao = 'ativa' and recebida_em is not null) then
      raise exception 'vaga_com_ativas' using errcode = 'P0001';
    end if;
    update public.rs_vagas set status = 'encerrada', encerrada_em = pg_catalog.now(), motivo_encerramento = p_motivo
     where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_encerrada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'motivo', p_motivo));
  end if;
end $$;


ALTER FUNCTION "public"."rs_fn_transicao_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_para" "public"."rs_status_vaga", "p_motivo" "public"."rs_motivo_encerramento_vaga", "p_alcance" "jsonb", "p_ator" "jsonb", "p_max_publicadas" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_troca_link"("p_candidatura" "uuid", "p_empresa" "uuid", "p_versao" integer, "p_hash" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.rs_candidaturas set link_versao = p_versao + 1, token_hash = p_hash
   where id = p_candidatura and empresa_id = p_empresa and link_versao = p_versao
     and token_hash not like 'anonimizada:%';
  return found;
end $$;


ALTER FUNCTION "public"."rs_fn_troca_link"("p_candidatura" "uuid", "p_empresa" "uuid", "p_versao" integer, "p_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rs_fn_vaga_no_alcance"("p_vaga" "uuid", "p_area" "uuid", "p_alcance" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  case p_alcance ->> 'tipo'
    when 'todas' then return true;
    when 'areas' then
      return p_area is not null and p_area::text in (select pg_catalog.jsonb_array_elements_text(p_alcance -> 'area_ids'));
    when 'equipe' then
      return exists (select 1 from public.rs_vaga_equipe where vaga_id = p_vaga
                     and membro_id = (p_alcance ->> 'membro_id')::uuid);
    else return false;
  end case;
end $$;


ALTER FUNCTION "public"."rs_fn_vaga_no_alcance"("p_vaga" "uuid", "p_area" "uuid", "p_alcance" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_fn_valida_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_max_tentativas" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura for update;
  if v.id is null or v.exclusao_codigo_hash is null then
    return 'sem_codigo';
  end if;
  if v.exclusao_expira_em < pg_catalog.now() then
    return 'expirado';
  end if;
  if v.exclusao_tentativas >= p_max_tentativas then
    return 'bloqueado';
  end if;
  if v.exclusao_codigo_hash <> p_codigo_hash then
    update public.rs_candidaturas set exclusao_tentativas = exclusao_tentativas + 1,
           exclusao_codigo_hash = case when exclusao_tentativas + 1 >= p_max_tentativas then null else exclusao_codigo_hash end
     where id = p_candidatura;
    if v.exclusao_tentativas + 1 >= p_max_tentativas then
      return 'bloqueado';
    end if;
    return 'errado:' || (p_max_tentativas - v.exclusao_tentativas - 1)::text;
  end if;
  update public.rs_candidaturas set exclusao_codigo_hash = null, exclusao_expira_em = null where id = p_candidatura;
  return 'ok';
end $$;


ALTER FUNCTION "public"."rs_fn_valida_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_max_tentativas" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rs_tg_vaga_encerrada_filhos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_vaga public.rs_vagas;
begin
  select * into v_vaga from public.rs_vagas where id = coalesce(new.vaga_id, old.vaga_id);
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if pg_catalog.current_setting('rs.expurgo_empresa', true) = v_vaga.empresa_id::text then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_vaga.status = 'encerrada' then
    raise exception 'vaga_encerrada' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;


ALTER FUNCTION "public"."rs_tg_vaga_encerrada_filhos"() OWNER TO "postgres";

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
    "talentos_avisado_em" timestamp with time zone,
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
    "recebida_em" timestamp with time zone,
    "exclusao_codigo_hash" "text",
    "exclusao_expira_em" timestamp with time zone,
    "exclusao_tentativas" smallint DEFAULT 0 NOT NULL,
    "exclusao_codigos_hora" smallint DEFAULT 0 NOT NULL,
    "exclusao_janela_desde" timestamp with time zone,
    "talentos_pedido" boolean DEFAULT false NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link_versao" integer DEFAULT 0 NOT NULL,
    "revisao_texto" "text",
    CONSTRAINT "rs_candidaturas_encerramento" CHECK ((("situacao" = 'ativa'::"public"."rs_situacao_candidatura") = ("encerrada_em" IS NULL))),
    CONSTRAINT "rs_candidaturas_expurgo" CHECK ((("situacao" <> 'ativa'::"public"."rs_situacao_candidatura") OR ("expurgar_em" IS NULL))),
    CONSTRAINT "rs_candidaturas_motivo" CHECK ((("motivo_reprovacao" IS NULL) OR ("situacao" = 'reprovada'::"public"."rs_situacao_candidatura"))),
    CONSTRAINT "rs_candidaturas_revisao_texto" CHECK (("char_length"("revisao_texto") <= 1000))
);


ALTER TABLE "public"."rs_candidaturas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rs_convites_talento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "candidato_id" "uuid" NOT NULL,
    "vaga_id" "uuid" NOT NULL,
    "ator_tipo" "public"."rs_tipo_ator" NOT NULL,
    "membro_id" "uuid",
    "credencial_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expira_em" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "usado_em" timestamp with time zone,
    CONSTRAINT "rs_convites_talento_ator" CHECK (("ator_tipo" = ANY (ARRAY['membro'::"public"."rs_tipo_ator", 'agente'::"public"."rs_tipo_ator", 'api'::"public"."rs_tipo_ator"])))
);


ALTER TABLE "public"."rs_convites_talento" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."rs_tentativas_publicas" (
    "id" bigint NOT NULL,
    "chave_hash" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rs_tentativas_chave" CHECK ((("char_length"("chave_hash") >= 16) AND ("char_length"("chave_hash") <= 128))),
    CONSTRAINT "rs_tentativas_tipo" CHECK (("tipo" = ANY (ARRAY['candidatura'::"text", 'links'::"text", 'links_email'::"text"])))
);


ALTER TABLE "public"."rs_tentativas_publicas" OWNER TO "postgres";


ALTER TABLE "public"."rs_tentativas_publicas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rs_tentativas_publicas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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
    "chave_idempotencia" "text",
    CONSTRAINT "rs_vagas_chave_idempotencia" CHECK ((("char_length"("chave_idempotencia") >= 1) AND ("char_length"("chave_idempotencia") <= 100))),
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



ALTER TABLE ONLY "public"."rs_convites_talento"
    ADD CONSTRAINT "rs_convites_talento_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."rs_tentativas_publicas"
    ADD CONSTRAINT "rs_tentativas_publicas_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "rs_candidaturas_atualizado" ON "public"."rs_candidaturas" USING "btree" ("empresa_id", "atualizado_em");



CREATE INDEX "rs_candidaturas_busca" ON "public"."rs_candidaturas" USING "gin" ("texto_busca");



CREATE INDEX "rs_candidaturas_candidato" ON "public"."rs_candidaturas" USING "btree" ("candidato_id");



CREATE INDEX "rs_candidaturas_etapa" ON "public"."rs_candidaturas" USING "btree" ("etapa_id");



CREATE INDEX "rs_candidaturas_expurgo" ON "public"."rs_candidaturas" USING "btree" ("expurgar_em") WHERE ("expurgar_em" IS NOT NULL);



CREATE INDEX "rs_candidaturas_funil" ON "public"."rs_candidaturas" USING "btree" ("empresa_id", "vaga_id", "situacao", "etapa_id");



CREATE INDEX "rs_candidaturas_nao_recebidas" ON "public"."rs_candidaturas" USING "btree" ("criado_em") WHERE ("recebida_em" IS NULL);



CREATE INDEX "rs_candidaturas_paradas" ON "public"."rs_candidaturas" USING "btree" ("empresa_id", "movida_em") WHERE ("situacao" = 'ativa'::"public"."rs_situacao_candidatura");



CREATE INDEX "rs_convites_talento_candidato" ON "public"."rs_convites_talento" USING "btree" ("candidato_id", "vaga_id");



CREATE INDEX "rs_convites_talento_credencial" ON "public"."rs_convites_talento" USING "btree" ("credencial_id");



CREATE INDEX "rs_convites_talento_empresa" ON "public"."rs_convites_talento" USING "btree" ("empresa_id");



CREATE INDEX "rs_convites_talento_membro" ON "public"."rs_convites_talento" USING "btree" ("membro_id");



CREATE INDEX "rs_convites_talento_vaga" ON "public"."rs_convites_talento" USING "btree" ("vaga_id");



CREATE INDEX "rs_credenciais_cliente" ON "public"."rs_credenciais" USING "btree" ("oauth_cliente_id");



CREATE INDEX "rs_credenciais_criada_por" ON "public"."rs_credenciais" USING "btree" ("criada_por_membro_id");



CREATE INDEX "rs_credenciais_empresa" ON "public"."rs_credenciais" USING "btree" ("empresa_id") WHERE ("revogada_em" IS NULL);



CREATE INDEX "rs_credenciais_membro" ON "public"."rs_credenciais" USING "btree" ("membro_id") WHERE ("revogada_em" IS NULL);



CREATE INDEX "rs_decisoes_candidatura" ON "public"."rs_decisoes" USING "btree" ("candidatura_id");



CREATE INDEX "rs_decisoes_credencial" ON "public"."rs_decisoes" USING "btree" ("credencial_id");



CREATE INDEX "rs_decisoes_decidida_por" ON "public"."rs_decisoes" USING "btree" ("decidida_por_membro_id");



CREATE INDEX "rs_decisoes_empresa_status" ON "public"."rs_decisoes" USING "btree" ("empresa_id", "status");



CREATE UNIQUE INDEX "rs_decisoes_pendente_candidatura" ON "public"."rs_decisoes" USING "btree" ("tipo", "candidatura_id") WHERE (("status" = 'pendente'::"public"."rs_status_decisao") AND ("candidatura_id" IS NOT NULL));



CREATE UNIQUE INDEX "rs_decisoes_pendente_vaga" ON "public"."rs_decisoes" USING "btree" ("tipo", "vaga_id") WHERE (("status" = 'pendente'::"public"."rs_status_decisao") AND ("vaga_id" IS NOT NULL));



CREATE INDEX "rs_decisoes_proposta_por" ON "public"."rs_decisoes" USING "btree" ("proposta_por_membro_id");



CREATE INDEX "rs_decisoes_vaga" ON "public"."rs_decisoes" USING "btree" ("vaga_id");



CREATE INDEX "rs_empresas_criada_por" ON "public"."rs_empresas" USING "btree" ("criada_por_usuario_id");



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



CREATE INDEX "rs_tentativas_idade" ON "public"."rs_tentativas_publicas" USING "btree" ("criado_em");



CREATE INDEX "rs_tentativas_janela" ON "public"."rs_tentativas_publicas" USING "btree" ("tipo", "chave_hash", "criado_em");



CREATE INDEX "rs_vaga_equipe_membro" ON "public"."rs_vaga_equipe" USING "btree" ("membro_id");



CREATE UNIQUE INDEX "rs_vaga_equipe_um_responsavel" ON "public"."rs_vaga_equipe" USING "btree" ("vaga_id") WHERE ("papel_na_vaga" = 'responsavel'::"public"."rs_papel_na_vaga");



CREATE INDEX "rs_vagas_area" ON "public"."rs_vagas" USING "btree" ("area_id");



CREATE INDEX "rs_vagas_dono" ON "public"."rs_vagas" USING "btree" ("dono_pessoa_id");



CREATE INDEX "rs_vagas_empresa_status" ON "public"."rs_vagas" USING "btree" ("empresa_id", "status");



CREATE UNIQUE INDEX "rs_vagas_idempotencia" ON "public"."rs_vagas" USING "btree" ("empresa_id", "chave_idempotencia") WHERE ("chave_idempotencia" IS NOT NULL);



CREATE INDEX "rs_webhooks_empresa" ON "public"."rs_webhooks" USING "btree" ("empresa_id");



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_areas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_avaliacoes" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_candidatos" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_empresas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_modelos_mensagem" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_atualizado_em" BEFORE UPDATE ON "public"."rs_vagas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "rs_tg_etapa_da_vaga" BEFORE INSERT OR UPDATE OF "etapa_id", "vaga_id", "empresa_id", "candidato_id" ON "public"."rs_candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_etapa_da_vaga"();



CREATE OR REPLACE TRIGGER "rs_tg_eventos_imutaveis" BEFORE DELETE OR UPDATE ON "public"."rs_eventos" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_eventos_imutaveis"();



CREATE OR REPLACE TRIGGER "rs_tg_situacao_candidatura" BEFORE INSERT OR UPDATE ON "public"."rs_candidaturas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_situacao_candidatura"();



CREATE OR REPLACE TRIGGER "rs_tg_vaga_congelada" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rs_perguntas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_vaga_congelada"();



CREATE OR REPLACE TRIGGER "rs_tg_vaga_congelada" BEFORE DELETE OR UPDATE ON "public"."rs_vagas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_vaga_congelada"();



CREATE OR REPLACE TRIGGER "rs_tg_vaga_encerrada_filhos" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rs_etapas" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_vaga_encerrada_filhos"();



CREATE OR REPLACE TRIGGER "rs_tg_vaga_encerrada_filhos" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rs_vaga_equipe" FOR EACH ROW EXECUTE FUNCTION "public"."rs_tg_vaga_encerrada_filhos"();



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



ALTER TABLE ONLY "public"."rs_convites_talento"
    ADD CONSTRAINT "rs_convites_talento_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "public"."rs_candidatos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_convites_talento"
    ADD CONSTRAINT "rs_convites_talento_credencial_id_fkey" FOREIGN KEY ("credencial_id") REFERENCES "public"."rs_credenciais"("id");



ALTER TABLE ONLY "public"."rs_convites_talento"
    ADD CONSTRAINT "rs_convites_talento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."rs_empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rs_convites_talento"
    ADD CONSTRAINT "rs_convites_talento_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."rs_membros"("id");



ALTER TABLE ONLY "public"."rs_convites_talento"
    ADD CONSTRAINT "rs_convites_talento_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "public"."rs_vagas"("id") ON DELETE CASCADE;



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


ALTER TABLE "public"."rs_convites_talento" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."rs_tentativas_publicas" ENABLE ROW LEVEL SECURITY;


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



REVOKE ALL ON FUNCTION "public"."rs_fn_adiciona_nota"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_texto" "text", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_adiciona_nota"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_texto" "text", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_alvo_da_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_alvo_da_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_anonimiza_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_anonimiza_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_area_no_alcance"("p_area" "uuid", "p_alcance" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_area_no_alcance"("p_area" "uuid", "p_alcance" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_arquiva_area"("p_area" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_arquiva_area"("p_area" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_arquiva_pessoa"("p_pessoa" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_arquiva_pessoa"("p_pessoa" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_atualiza_busca"("p_candidatura" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_atualiza_busca"("p_candidatura" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_busca_talentos"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_busca_talentos"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cancela_convite"("p_membro" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cancela_convite"("p_membro" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_conclui_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_arquivo" "jsonb", "p_mensagem" "jsonb", "p_notificacao" "jsonb", "p_ator" "jsonb", "p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_conclui_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_arquivo" "jsonb", "p_mensagem" "jsonb", "p_notificacao" "jsonb", "p_ator" "jsonb", "p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_confere_vaga"("p_empresa" "uuid", "p_area" "uuid", "p_dono" "uuid", "p_alcance" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_confere_vaga"("p_empresa" "uuid", "p_area" "uuid", "p_dono" "uuid", "p_alcance" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_confirma_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_confirma_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_conta_tentativa"("p_chave" "text", "p_tipo" "text", "p_limite" integer, "p_janela_s" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_conta_tentativa"("p_chave" "text", "p_tipo" "text", "p_limite" integer, "p_janela_s" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_convida_membro"("p_empresa" "uuid", "p_email" "text", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_convida_membro"("p_empresa" "uuid", "p_email" "text", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_convida_talento"("p_empresa" "uuid", "p_candidato" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_convida_talento"("p_empresa" "uuid", "p_candidato" "uuid", "p_vaga" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_candidatura"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidato" "jsonb", "p_respostas" "jsonb", "p_origem" "public"."rs_origem_candidatura", "p_ator" "jsonb", "p_consentimento" "text", "p_talentos" boolean, "p_token_hash" "text", "p_max_por_vaga" integer, "p_convite" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_candidatura"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidato" "jsonb", "p_respostas" "jsonb", "p_origem" "public"."rs_origem_candidatura", "p_ator" "jsonb", "p_consentimento" "text", "p_talentos" boolean, "p_token_hash" "text", "p_max_por_vaga" integer, "p_convite" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_chave_api"("p_empresa" "uuid", "p_nome" "text", "p_prefixo" "text", "p_valor_hash" "text", "p_escopos" "public"."rs_escopo"[], "p_max_ativas" integer, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_chave_api"("p_empresa" "uuid", "p_nome" "text", "p_prefixo" "text", "p_valor_hash" "text", "p_escopos" "public"."rs_escopo"[], "p_max_ativas" integer, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_empresa" "uuid", "p_membro" "uuid", "p_escopos" "public"."rs_escopo"[], "p_redirect_uri" "text", "p_code_challenge" "text", "p_validade_s" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_empresa" "uuid", "p_membro" "uuid", "p_escopos" "public"."rs_escopo"[], "p_redirect_uri" "text", "p_code_challenge" "text", "p_validade_s" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_empresa"("p_usuario" "uuid", "p_slug" "text", "p_nome" "text", "p_email_contato" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_empresa"("p_usuario" "uuid", "p_slug" "text", "p_nome" "text", "p_email_contato" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_cria_vaga"("p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb", "p_chave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_cria_vaga"("p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb", "p_chave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_da_acesso"("p_pessoa" "uuid", "p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_da_acesso"("p_pessoa" "uuid", "p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_max_pendentes" integer, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_decide"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_decide"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_descarta_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_motivo" "text", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_descarta_decisao"("p_decisao" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_motivo" "text", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_encerra_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_situacao" "public"."rs_situacao_candidatura", "p_ator" "jsonb", "p_motivo" "public"."rs_motivo_reprovacao", "p_mensagem" "jsonb", "p_dados" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_encerra_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_situacao" "public"."rs_situacao_candidatura", "p_ator" "jsonb", "p_motivo" "public"."rs_motivo_reprovacao", "p_mensagem" "jsonb", "p_dados" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_entra_usuario"("p_google_sub" "text", "p_email" "text", "p_nome" "text", "p_foto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_entra_usuario"("p_google_sub" "text", "p_email" "text", "p_nome" "text", "p_foto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_envia_mensagem"("p_candidatura" "uuid", "p_empresa" "uuid", "p_tipo" "public"."rs_tipo_mensagem", "p_mensagem" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid", "p_cota" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_envia_mensagem"("p_candidatura" "uuid", "p_empresa" "uuid", "p_tipo" "public"."rs_tipo_mensagem", "p_mensagem" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid", "p_cota" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_exclui_dados_candidato"("p_candidatura" "uuid", "p_empresa" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_exclui_dados_candidato"("p_candidatura" "uuid", "p_empresa" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_executa_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_executa_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_mensagens" "jsonb", "p_ator" "jsonb", "p_decisao" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_expurga_empresa"("p_empresa" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_expurga_empresa"("p_empresa" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_faxina_candidaturas_abandonadas"("p_lote" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_faxina_candidaturas_abandonadas"("p_lote" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_faxina_decisoes"("p_lote" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_faxina_decisoes"("p_lote" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_faxina_talentos"("p_lote" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_faxina_talentos"("p_lote" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_faxina_vagas_vencidas"("p_lote" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_faxina_vagas_vencidas"("p_lote" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_garante_administrador"("p_membro" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_garante_administrador"("p_membro" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_grava_equipe"("p_vaga" "uuid", "p_empresa" "uuid", "p_equipe" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_grava_equipe"("p_vaga" "uuid", "p_empresa" "uuid", "p_equipe" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_grava_etapas"("p_vaga" "uuid", "p_etapas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_grava_etapas"("p_vaga" "uuid", "p_etapas" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_grava_extracao"("p_arquivo" "uuid", "p_status" "public"."rs_status_extracao", "p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_grava_extracao"("p_arquivo" "uuid", "p_status" "public"."rs_status_extracao", "p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_grava_perguntas"("p_vaga" "uuid", "p_perguntas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_grava_perguntas"("p_vaga" "uuid", "p_perguntas" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_lista_candidaturas"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_lista_candidaturas"("p_empresa" "uuid", "p_alcance" "jsonb", "p_filtros" "jsonb", "p_inicio" integer, "p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_move_etapa"("p_ids" "uuid"[], "p_empresa" "uuid", "p_etapa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_move_etapa"("p_ids" "uuid"[], "p_empresa" "uuid", "p_etapa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_muda_acesso"("p_membro" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_muda_acesso"("p_membro" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas_areas" boolean, "p_areas" "uuid"[], "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_novo_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_validade_s" integer, "p_intervalo_s" integer, "p_max_hora" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_novo_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_validade_s" integer, "p_intervalo_s" integer, "p_max_hora" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_pede_revisao"("p_candidatura" "uuid", "p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_pede_revisao"("p_candidatura" "uuid", "p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_propoe_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_justificativa" "text", "p_ator" "jsonb", "p_alcance" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_propoe_decisao"("p_empresa" "uuid", "p_tipo" "public"."rs_tipo_decisao", "p_candidatura" "uuid", "p_vaga" "uuid", "p_payload" "jsonb", "p_justificativa" "text", "p_ator" "jsonb", "p_alcance" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_reabre_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_reabre_candidatura"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_reenvia_convite"("p_membro" "uuid", "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_reenvia_convite"("p_membro" "uuid", "p_token_hash" "text", "p_expira_em" timestamp with time zone, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_registra_avaliacao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_etapa" "uuid", "p_membro" "uuid", "p_recomendacao" "public"."rs_recomendacao", "p_comentario" "text", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_registra_avaliacao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_etapa" "uuid", "p_membro" "uuid", "p_recomendacao" "public"."rs_recomendacao", "p_comentario" "text", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_registra_evento"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidatura" "uuid", "p_tipo" "text", "p_ator" "jsonb", "p_origem" "public"."rs_origem_evento", "p_dados" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_registra_evento"("p_empresa" "uuid", "p_vaga" "uuid", "p_candidatura" "uuid", "p_tipo" "text", "p_ator" "jsonb", "p_origem" "public"."rs_origem_evento", "p_dados" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_remove_membro"("p_membro" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_remove_membro"("p_membro" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_responde_revisao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_mensagem" "jsonb", "p_reabrir" boolean, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_responde_revisao"("p_candidatura" "uuid", "p_empresa" "uuid", "p_alcance" "jsonb", "p_mensagem" "jsonb", "p_reabrir" boolean, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_revoga_credencial"("p_credencial" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_revoga_credencial"("p_credencial" "uuid", "p_empresa" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_salva_area"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_responsavel" "uuid", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_salva_area"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_responsavel" "uuid", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_salva_pessoa"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_email" "text", "p_cargo" "text", "p_area" "uuid", "p_recebe_resumo" boolean, "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_salva_pessoa"("p_empresa" "uuid", "p_id" "uuid", "p_nome" "text", "p_email" "text", "p_cargo" "text", "p_area" "uuid", "p_recebe_resumo" boolean, "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_salva_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_salva_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_dados" "jsonb", "p_alcance" "jsonb", "p_ator" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_slug_vaga"("p_empresa" "uuid", "p_base" "text", "p_vaga" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_slug_vaga"("p_empresa" "uuid", "p_base" "text", "p_vaga" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_talento_no_alcance"("p_candidato" "uuid", "p_alcance" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_talento_no_alcance"("p_candidato" "uuid", "p_alcance" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_talentos_candidato"("p_candidatura" "uuid", "p_acao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_talentos_candidato"("p_candidatura" "uuid", "p_acao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_transicao_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_para" "public"."rs_status_vaga", "p_motivo" "public"."rs_motivo_encerramento_vaga", "p_alcance" "jsonb", "p_ator" "jsonb", "p_max_publicadas" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_transicao_vaga"("p_vaga" "uuid", "p_empresa" "uuid", "p_para" "public"."rs_status_vaga", "p_motivo" "public"."rs_motivo_encerramento_vaga", "p_alcance" "jsonb", "p_ator" "jsonb", "p_max_publicadas" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_troca_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_redirect_uri" "text", "p_challenge_do_verifier" "text", "p_token_hash" "text", "p_token_prefixo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_troca_codigo_oauth"("p_codigo_hash" "text", "p_cliente" "uuid", "p_redirect_uri" "text", "p_challenge_do_verifier" "text", "p_token_hash" "text", "p_token_prefixo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_troca_link"("p_candidatura" "uuid", "p_empresa" "uuid", "p_versao" integer, "p_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_troca_link"("p_candidatura" "uuid", "p_empresa" "uuid", "p_versao" integer, "p_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_vaga_no_alcance"("p_vaga" "uuid", "p_area" "uuid", "p_alcance" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_vaga_no_alcance"("p_vaga" "uuid", "p_area" "uuid", "p_alcance" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_valida_areas"("p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas" boolean, "p_areas" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_valida_areas"("p_empresa" "uuid", "p_papel" "public"."rs_papel_membro", "p_todas" boolean, "p_areas" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rs_fn_valida_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_max_tentativas" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_fn_valida_codigo_exclusao"("p_candidatura" "uuid", "p_codigo_hash" "text", "p_max_tentativas" integer) TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."rs_tg_vaga_encerrada_filhos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rs_tg_vaga_encerrada_filhos"() TO "service_role";



GRANT ALL ON TABLE "public"."rs_areas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_arquivos" TO "service_role";



GRANT ALL ON TABLE "public"."rs_avaliacoes" TO "service_role";



GRANT ALL ON TABLE "public"."rs_candidatos" TO "service_role";



GRANT ALL ON TABLE "public"."rs_candidaturas" TO "service_role";



GRANT ALL ON TABLE "public"."rs_convites_talento" TO "service_role";



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



GRANT ALL ON TABLE "public"."rs_tentativas_publicas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rs_tentativas_publicas_id_seq" TO "service_role";



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







