-- Contrata — épico 8.10, correções do verifier (spec.md v0.4.11; 7.4, 11.12, 11.13, 11.31): a
-- candidatura que guarda o currículo de quem está no banco de talentos mantém o link /c (aviso,
-- renovar e excluir continuam valendo), marcada por expurgada_em; só o currículo mais recente fica;
-- arquivo que o bucket não apagou fica anotado para a próxima rodada; o resumo semanal pagina; e
-- pedir acesso de novo no mesmo dia não repete o evento.

-- ---------------------------------------------------------------- estrutura
-- Quando a candidatura foi anonimizada pelo expurgo ou a pedido. A que guarda o currículo do banco de
-- talentos tem expurgada_em e mantém o token (o link /c segue valendo para a pessoa).
alter table public.rs_candidaturas add column expurgada_em timestamptz;
update public.rs_candidaturas set expurgada_em = coalesce(encerrada_em, criado_em) where token_hash like 'anonimizada:%';

-- Arquivos que o banco já esqueceu e o bucket ainda não apagou (falha de rede): a faxina tenta de
-- novo. Só o caminho (uuids), sem dado pessoal.
create table public.rs_arquivos_a_apagar (
  path text primary key,
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index rs_arquivos_a_apagar_empresa on public.rs_arquivos_a_apagar (empresa_id);
alter table public.rs_arquivos_a_apagar enable row level security;
revoke all on table public.rs_arquivos_a_apagar from anon, authenticated;

-- ---------------------------------------------------------------- anonimizar (7.4, 11.12)
-- Anonimiza a candidatura e marca expurgada_em. Com p_manter_curriculo (banco de talentos), o
-- currículo e o link ficam; senão o token vira 'anonimizada:'. Recebe: candidatura, empresa, se
-- mantém o currículo e a origem do evento. Devolve os caminhos dos arquivos apagados.
drop function public.rs_fn_anonimiza_candidatura(uuid, uuid, boolean);
create function public.rs_fn_anonimiza_candidatura(p_candidatura uuid, p_empresa uuid, p_manter_curriculo boolean default false,
  p_origem public.rs_origem_evento default 'publico') returns text[]
language plpgsql set search_path = '' as $$
declare
  v_paths text[];
  v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.array_agg(path), '{}') into v_paths from public.rs_arquivos
   where candidatura_id = p_candidatura and not (p_manter_curriculo and tipo = 'curriculo');
  delete from public.rs_arquivos where candidatura_id = p_candidatura and not (p_manter_curriculo and tipo = 'curriculo');
  delete from public.rs_respostas where candidatura_id = p_candidatura;
  delete from public.rs_notas where candidatura_id = p_candidatura;
  update public.rs_avaliacoes set comentario = '' where candidatura_id = p_candidatura;
  update public.rs_mensagens set assunto = '', corpo = '' where candidatura_id = p_candidatura;
  update public.rs_notificacoes set status = 'descartada', html = '', texto = ''
   where candidatura_id = p_candidatura and status in ('pendente', 'falhou');
  update public.rs_candidaturas set texto_busca = null, sinalizada = false, exclusao_codigo_hash = null, revisao_texto = null,
         expurgada_em = pg_catalog.now(),
         token_hash = case when p_manter_curriculo then token_hash else 'anonimizada:' || id::text end
   where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_anonimizada',
    pg_catalog.jsonb_build_object('tipo', 'sistema'), p_origem, pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  return v_paths;
end $$;

-- ---------------------------------------------------------------- expurgo (11.12)
-- 1) Candidatura com expurgar_em vencido e ainda não expurgada → anonimiza. Se a pessoa tem
--    consentimento de talentos válido e esta é a candidatura mais recente dela com currículo, o
--    currículo e o link ficam (os currículos guardados antes saem: só o mais recente fica).
-- 2) Pessoa sem candidatura por expurgar (todas expurgadas), sem consentimento válido e ainda não
--    anonimizada → apaga o currículo guardado, desliga os links e anonimiza o cadastro.
-- Recebe: o lote. Devolve {candidaturas, pessoas, paths}.
create or replace function public.rs_fn_faxina_expurgos(p_lote integer) returns jsonb
language plpgsql set search_path = '' as $$
declare
  c record;
  k record;
  v_paths text[] := '{}';
  v_cands integer := 0;
  v_pessoas integer := 0;
  v_manter boolean;
begin
  for c in select id, empresa_id, candidato_id from public.rs_candidaturas
            where expurgar_em <= pg_catalog.now() and expurgada_em is null and token_hash not like 'anonimizada:%'
            order by expurgar_em limit p_lote for update skip locked loop
    v_manter := exists (select 1 from public.rs_candidatos t where t.id = c.candidato_id and t.anonimizado_em is null
                          and t.talentos_expira_em > pg_catalog.now())
                and c.id = (select x.id from public.rs_candidaturas x
                             where x.candidato_id = c.candidato_id and x.recebida_em is not null
                               and exists (select 1 from public.rs_arquivos a where a.candidatura_id = x.id and a.tipo = 'curriculo')
                             order by x.recebida_em desc limit 1);
    if v_manter then
      -- Só o currículo mais recente fica: os guardados de candidaturas já expurgadas saem.
      v_paths := v_paths || coalesce((select pg_catalog.array_agg(a.path) from public.rs_arquivos a
                                        join public.rs_candidaturas x on x.id = a.candidatura_id
                                       where x.candidato_id = c.candidato_id and x.id <> c.id and x.expurgada_em is not null), '{}');
      delete from public.rs_arquivos a using public.rs_candidaturas x
       where x.id = a.candidatura_id and x.candidato_id = c.candidato_id and x.id <> c.id and x.expurgada_em is not null;
    end if;
    v_paths := v_paths || public.rs_fn_anonimiza_candidatura(c.id, c.empresa_id, v_manter, 'cron');
    v_cands := v_cands + 1;
  end loop;
  for k in select t.id from public.rs_candidatos t
            where t.anonimizado_em is null and (t.talentos_expira_em is null or t.talentos_expira_em <= pg_catalog.now())
              and exists (select 1 from public.rs_candidaturas x where x.candidato_id = t.id)
              and not exists (select 1 from public.rs_candidaturas x where x.candidato_id = t.id and x.expurgada_em is null)
            limit p_lote for update skip locked loop
    v_paths := v_paths || coalesce((select pg_catalog.array_agg(a.path) from public.rs_arquivos a
                                      join public.rs_candidaturas x on x.id = a.candidatura_id where x.candidato_id = k.id), '{}');
    delete from public.rs_arquivos a using public.rs_candidaturas x where x.id = a.candidatura_id and x.candidato_id = k.id;
    update public.rs_candidaturas set token_hash = 'anonimizada:' || id::text
     where candidato_id = k.id and token_hash not like 'anonimizada:%';
    update public.rs_candidatos set nome = 'Pessoa removida', email = null, telefone = null, linkedin_url = null, cidade = null,
           talentos_consentido_em = null, talentos_expira_em = null, talentos_avisado_em = null, anonimizado_em = pg_catalog.now()
     where id = k.id;
    v_pessoas := v_pessoas + 1;
  end loop;
  return pg_catalog.jsonb_build_object('candidaturas', v_cands, 'pessoas', v_pessoas, 'paths', pg_catalog.to_jsonb(v_paths));
end $$;

-- ---------------------------------------------------------------- resumo semanal (11.31)
-- Como antes, com paginação (p_inicio): o servidor percorre todas as vagas, não só o primeiro lote.
drop function public.rs_fn_resumo_donos(integer);
create function public.rs_fn_resumo_donos(p_lote integer, p_inicio integer default 0) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(r), '[]') from (
    select v.id as vaga_id, v.titulo, v.empresa_id, e.nome as empresa, e.slug, e.cor_destaque, e.logo_path, e.email_contato,
           p.id as pessoa_id, p.nome, p.email,
           (select count(*) from public.rs_candidaturas c join public.rs_etapas t on t.id = c.etapa_id
             where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null and t.tipo = 'triagem')::int as em_analise,
           (select count(*) from public.rs_candidaturas c join public.rs_etapas t on t.id = c.etapa_id
             where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null and t.tipo = 'entrevista')::int as entrevistas,
           (select count(*) from public.rs_candidaturas c join public.rs_etapas t on t.id = c.etapa_id
             where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null and t.tipo in ('avaliacao', 'proposta'))::int as fase_final,
           (select count(*) from public.rs_candidaturas c where c.vaga_id = v.id and c.recebida_em is not null
             and c.encerrada_em > pg_catalog.now() - interval '7 days')::int as encerradas_semana,
           exists (select 1 from public.rs_candidaturas c where c.vaga_id = v.id and c.situacao = 'contratada') as contratada,
           (select u.nome from public.rs_vaga_equipe q join public.rs_membros m on m.id = q.membro_id join public.rs_usuarios u on u.id = m.usuario_id
             where q.vaga_id = v.id and q.papel_na_vaga = 'responsavel' and m.removido_em is null limit 1) as recrutador
      from public.rs_vagas v
      join public.rs_pessoas p on p.id = v.dono_pessoa_id
      join public.rs_empresas e on e.id = v.empresa_id
     where v.status in ('publicada', 'pausada') and p.membro_id is null and p.recebe_resumo and p.arquivada_em is null
       and e.excluida_em is null and e.suspensa_em is null
     order by v.empresa_id, v.id offset greatest(p_inicio, 0) limit greatest(p_lote, 0)
  ) r $$;

-- ---------------------------------------------------------------- pedir acesso (11.31)
-- Como antes; pedir de novo em menos de 24 h não repete o evento (só o e-mail é deduplicado pela chave).
create or replace function public.rs_fn_pede_acesso(p_empresa uuid, p_pessoa uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare p public.rs_pessoas;
begin
  select * into p from public.rs_pessoas where id = p_pessoa and empresa_id = p_empresa;
  if p.id is null or p.membro_id is not null or p.arquivada_em is not null
     or not exists (select 1 from public.rs_empresas where id = p_empresa and excluida_em is null and suspensa_em is null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_eventos where empresa_id = p_empresa and tipo = 'acesso_pedido'
                   and dados ->> 'pessoa_id' = p_pessoa::text and criado_em > pg_catalog.now() - interval '24 hours') then
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'acesso_pedido', '{"tipo":"sistema","origem":"publico"}', 'publico',
      pg_catalog.jsonb_build_object('pessoa_id', p_pessoa));
  end if;
  return pg_catalog.jsonb_build_object('nome', p.nome, 'administradores', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'email', u.email))
      from public.rs_membros m join public.rs_usuarios u on u.id = m.usuario_id
     where m.empresa_id = p_empresa and m.papel = 'administrador' and m.removido_em is null and u.suspenso_em is null), '[]'));
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
